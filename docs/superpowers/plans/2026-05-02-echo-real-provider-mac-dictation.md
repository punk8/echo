# Echo Real-Provider Mac Dictation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS Electron dictation app that records speech, sends audio to real OpenAI ASR, refines the transcript with a real OpenAI-compatible LLM, inserts the result into the active app, and stores local history.

**Architecture:** Use a pnpm TypeScript monorepo with `apps/desktop` for Electron/React, `services/api` for the local backend, and `packages/shared` for schemas and state contracts. The desktop app owns shortcut, recording, overlay, local storage, and insertion; the backend owns provider keys, ASR, LLM refinement, validation, and the dictation HTTP API. Production runtime must not include a selectable mock provider.

**Tech Stack:** pnpm, Node 22, TypeScript, Vitest, Zod, Fastify, `@fastify/multipart`, OpenAI SDK for ASR, fetch-compatible chat completions for LLM, Electron, Vite, React, better-sqlite3, CSS modules or plain CSS.

---

## Source Specs

- Product spec: `spec/2026-05-02-echo-real-provider-mac-dictation.md`
- Requirements: `docs/requirements/mac-dictation-requirements.md`
- UX teardown: `docs/research/typeless-mac-ux-teardown.md`
- Architecture reference: `docs/technical/electron-mac-dictation-technical-spec.md`

## File Structure

Create this structure:

```text
package.json
pnpm-workspace.yaml
tsconfig.base.json
vitest.config.ts
.env.example

packages/shared/
  package.json
  src/index.ts
  src/dictation/contracts.ts
  src/dictation/errors.ts
  src/dictation/stateMachine.ts
  src/dictation/stateMachine.test.ts
  src/dictation/contracts.test.ts

services/api/
  package.json
  src/index.ts
  src/server.ts
  src/config/env.ts
  src/config/env.test.ts
  src/dictation/dictationRoute.ts
  src/dictation/dictationRoute.test.ts
  src/providers/asr/ASRProvider.ts
  src/providers/asr/OpenAITranscribeProvider.ts
  src/providers/asr/OpenAITranscribeProvider.test.ts
  src/providers/llm/LLMProvider.ts
  src/providers/llm/OpenAICompatibleLLMProvider.ts
  src/providers/llm/OpenAICompatibleLLMProvider.test.ts
  src/refiner/buildDictationPrompt.ts
  src/refiner/buildDictationPrompt.test.ts
  src/refiner/validateRefinedResult.ts
  src/refiner/validateRefinedResult.test.ts
  src/test/fixtures.ts

apps/desktop/
  package.json
  index.html
  electron.vite.config.ts
  src/main/index.ts
  src/main/appPaths.ts
  src/main/dictation/sessionController.ts
  src/main/dictation/sessionController.test.ts
  src/main/ipc.ts
  src/main/storage/database.ts
  src/main/storage/historyRepository.ts
  src/main/storage/historyRepository.test.ts
  src/main/storage/settingsRepository.ts
  src/main/storage/settingsRepository.test.ts
  src/main/storage/dictionaryRepository.ts
  src/main/storage/dictionaryRepository.test.ts
  src/main/platform/context.ts
  src/main/platform/context.test.ts
  src/main/platform/insertion.ts
  src/main/platform/insertion.test.ts
  src/main/platform/shortcut.ts
  src/preload/index.ts
  src/renderer/App.tsx
  src/renderer/main.tsx
  src/renderer/styles.css
  src/renderer/api/desktopApi.ts
  src/renderer/components/Overlay.tsx
  src/renderer/components/Overlay.test.tsx
  src/renderer/components/HubLayout.tsx
  src/renderer/pages/HomePage.tsx
  src/renderer/pages/HistoryPage.tsx
  src/renderer/pages/DictionaryPage.tsx
  src/renderer/pages/SettingsPage.tsx
  src/renderer/recording/audioRecorder.ts
  src/renderer/recording/audioRecorder.test.ts
```

## Task 1: Monorepo Scaffold and Environment Contract

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `packages/shared/package.json`
- Create: `services/api/package.json`
- Create: `apps/desktop/package.json`

- [ ] **Step 1: Create workspace metadata**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "services/*"
  - "packages/*"
```

Create root `package.json`:

```json
{
  "name": "echo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.13.1",
  "scripts": {
    "dev": "pnpm --parallel dev",
    "dev:api": "pnpm --filter @echo/api dev",
    "dev:desktop": "pnpm --filter @echo/desktop dev",
    "build": "pnpm --recursive build",
    "typecheck": "pnpm --recursive typecheck",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "pnpm typecheck",
    "verify": "pnpm typecheck && pnpm test && pnpm build"
  },
  "devDependencies": {
    "@types/node": "^22.13.0",
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create TypeScript and Vitest config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  }
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/**/*.test.ts",
      "services/**/*.test.ts",
      "apps/**/*.test.ts",
      "apps/**/*.test.tsx"
    ],
    coverage: {
      reporter: ["text", "lcov"]
    }
  }
});
```

- [ ] **Step 3: Create secret-free environment template**

Create `.env.example`:

```bash
NODE_ENV=development
API_HOST=127.0.0.1
API_PORT=43110

ASR_PROVIDER=openai
ASR_MODEL=gpt-4o-transcribe
ASR_BASE_URL=https://api.openai.com/v1
ASR_LANGUAGE=auto
ASR_API_KEY=replace-with-local-secret

LLM_PROVIDER=openai-compatible
LLM_MODEL=replace-with-model-id
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=replace-with-local-secret
LLM_TEMPERATURE=0.2

RUN_REAL_PROVIDER_TESTS=0
```

- [ ] **Step 4: Create package manifests**

Create `packages/shared/package.json`:

```json
{
  "name": "@echo/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0"
  }
}
```

Create `services/api/package.json`:

```json
{
  "name": "@echo/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test:real": "RUN_REAL_PROVIDER_TESTS=1 vitest run services/api/src/providers"
  },
  "dependencies": {
    "@echo/shared": "workspace:*",
    "@fastify/multipart": "^9.0.0",
    "dotenv": "^16.4.0",
    "fastify": "^5.2.0",
    "openai": "^4.85.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.8.0"
  }
}
```

Create `apps/desktop/package.json`:

```json
{
  "name": "@echo/desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "preview": "electron-vite preview"
  },
  "dependencies": {
    "@echo/shared": "workspace:*",
    "@vitejs/plugin-react": "^4.3.0",
    "better-sqlite3": "^11.8.0",
    "electron-store": "^10.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.2.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "electron": "^34.0.0",
    "electron-vite": "^3.0.0",
    "typescript": "^5.8.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
pnpm install
```

Expected: lockfile created and install completes with exit code 0.

- [ ] **Step 6: Verify scaffold**

Run:

```bash
pnpm typecheck
```

Expected: typecheck may fail only because package `tsconfig.json` files are not created yet. The next task creates them. Do not commit until Task 2 establishes the first passing typecheck.

## Task 2: Shared Contracts and Dictation State Machine

**Files:**
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/dictation/contracts.ts`
- Create: `packages/shared/src/dictation/errors.ts`
- Create: `packages/shared/src/dictation/stateMachine.ts`
- Test: `packages/shared/src/dictation/contracts.test.ts`
- Test: `packages/shared/src/dictation/stateMachine.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `packages/shared/src/dictation/contracts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DictationProcessRequestSchema, DictationSuccessResponseSchema } from "./contracts";

describe("dictation contracts", () => {
  it("accepts the real-provider dictation request shape", () => {
    const result = DictationProcessRequestSchema.parse({
      session_id: "session-1",
      audio_format: "webm",
      duration_ms: 7200,
      language: "auto",
      context: {
        app_name: "TextEdit",
        bundle_id: "com.apple.TextEdit",
        window_title: "Untitled",
        writable: true,
        selection_present: false,
        nearby_text: ""
      },
      dictionary: [
        {
          term: "Echo",
          aliases: [],
          case_sensitive: true,
          source: "manual"
        }
      ],
      preferences: {
        style: "balanced",
        output_language: "follow_input",
        format_lists: true
      }
    });

    expect(result.audio_format).toBe("webm");
    expect(result.dictionary[0]?.term).toBe("Echo");
  });

  it("rejects unsupported audio formats before provider calls", () => {
    expect(() =>
      DictationProcessRequestSchema.parse({
        session_id: "session-1",
        audio_format: "ogg",
        duration_ms: 1000,
        language: "auto",
        context: {
          app_name: "TextEdit",
          bundle_id: "com.apple.TextEdit",
          window_title: "Untitled",
          writable: true,
          selection_present: false,
          nearby_text: ""
        },
        dictionary: [],
        preferences: {
          style: "balanced",
          output_language: "follow_input",
          format_lists: true
        }
      })
    ).toThrow();
  });

  it("accepts provider metadata on successful responses", () => {
    const result = DictationSuccessResponseSchema.parse({
      session_id: "session-1",
      raw_text: "um tomorrow at seven no make it three",
      refined_text: "Tomorrow at three.",
      language: "en",
      provider: {
        asr: "openai:gpt-4o-transcribe",
        llm: "openai-compatible:gpt-4o"
      },
      timing: {
        upload_received_at: "2026-05-02T12:00:00.000Z",
        asr_ms: 1200,
        refine_ms: 800,
        total_ms: 2100
      },
      quality: {
        risk: "low",
        warnings: []
      }
    });

    expect(result.refined_text).toBe("Tomorrow at three.");
  });
});
```

- [ ] **Step 2: Run schema tests and verify RED**

Run:

```bash
pnpm test packages/shared/src/dictation/contracts.test.ts
```

Expected: FAIL with import errors for `./contracts`.

- [ ] **Step 3: Implement shared contracts**

Create `packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src"]
}
```

Create `packages/shared/src/dictation/contracts.ts` with Zod schemas for:

- `AudioFormatSchema`: union of `webm` and `wav`
- `DictationContextSchema`
- `DictionaryTermSchema`
- `DictationPreferencesSchema`
- `DictationProcessRequestSchema`
- `DictationSuccessResponseSchema`
- `DictationErrorResponseSchema`

Export matching TypeScript types with `z.infer`.

Use these exact enum values:

```ts
export const AudioFormatSchema = z.enum(["webm", "wav"]);
export const DictationStyleSchema = z.enum(["literal", "balanced", "polished"]);
export const OutputLanguageSchema = z.enum(["follow_input", "zh", "en"]);
export const QualityRiskSchema = z.enum(["low", "medium", "high"]);
```

- [ ] **Step 4: Run schema tests and verify GREEN**

Run:

```bash
pnpm test packages/shared/src/dictation/contracts.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing state-machine tests**

Create `packages/shared/src/dictation/stateMachine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyDictationEvent } from "./stateMachine";

describe("dictation state machine", () => {
  it("moves through the normal dictation lifecycle", () => {
    let state = applyDictationEvent({ status: "idle" }, { type: "prepare" });
    state = applyDictationEvent(state, { type: "recording_started", sessionId: "s1" });
    state = applyDictationEvent(state, { type: "stop_requested" });
    state = applyDictationEvent(state, { type: "processing_started" });
    state = applyDictationEvent(state, { type: "insert_started" });
    state = applyDictationEvent(state, { type: "completed" });

    expect(state.status).toBe("complete");
  });

  it("allows cancellation only while recording or finalizing", () => {
    expect(applyDictationEvent({ status: "recording", sessionId: "s1" }, { type: "cancel" }).status).toBe("cancelled");
    expect(() => applyDictationEvent({ status: "processing", sessionId: "s1" }, { type: "cancel" })).toThrow("Cannot cancel from processing");
  });

  it("keeps error code and message in error state", () => {
    const state = applyDictationEvent(
      { status: "processing", sessionId: "s1" },
      { type: "fail", code: "server.asr_failed", message: "Speech recognition failed." }
    );

    expect(state).toEqual({
      status: "error",
      sessionId: "s1",
      code: "server.asr_failed",
      message: "Speech recognition failed."
    });
  });
});
```

- [ ] **Step 6: Run state-machine tests and verify RED**

Run:

```bash
pnpm test packages/shared/src/dictation/stateMachine.test.ts
```

Expected: FAIL with import error for `./stateMachine`.

- [ ] **Step 7: Implement state machine and shared exports**

Create `packages/shared/src/dictation/errors.ts` with the error code union from the spec:

```ts
export const DictationErrorCodes = [
  "permission.microphone_missing",
  "permission.accessibility_missing",
  "shortcut.conflict",
  "target.no_writable_field",
  "target.focus_changed",
  "audio.device_unavailable",
  "audio.no_speech_detected",
  "insert.failed",
  "config.asr_missing",
  "config.llm_missing",
  "server.asr_failed",
  "server.refine_failed",
  "server.provider_timeout",
  "server.provider_rate_limited",
  "server.audio_too_large",
  "server.unsupported_audio_format"
] as const;

export type DictationErrorCode = (typeof DictationErrorCodes)[number];
```

Create `packages/shared/src/dictation/stateMachine.ts` with states:

```ts
export type DictationState =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "recording"; sessionId: string }
  | { status: "finalizing"; sessionId: string }
  | { status: "processing"; sessionId: string }
  | { status: "inserting"; sessionId: string }
  | { status: "complete"; sessionId: string }
  | { status: "cancelled"; sessionId: string }
  | { status: "error"; sessionId?: string; code: string; message: string };
```

Implement `applyDictationEvent(state, event)` using explicit transition checks. Throw with messages like `Cannot cancel from processing` for invalid transitions.

Create `packages/shared/src/index.ts` exporting all dictation modules.

- [ ] **Step 8: Run shared tests and typecheck**

Run:

```bash
pnpm test packages/shared/src/dictation
pnpm --filter @echo/shared typecheck
```

Expected: PASS for tests and typecheck.

- [ ] **Step 9: Commit shared contracts**

Run:

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json vitest.config.ts .env.example packages/shared
git commit -m "feat: add shared dictation contracts"
```

Expected: commit created.

## Task 3: Backend Configuration and Provider Interfaces

**Files:**
- Create: `services/api/tsconfig.json`
- Create: `services/api/src/config/env.ts`
- Test: `services/api/src/config/env.test.ts`
- Create: `services/api/src/providers/asr/ASRProvider.ts`
- Create: `services/api/src/providers/llm/LLMProvider.ts`

- [ ] **Step 1: Write failing env tests**

Create `services/api/src/config/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadApiEnv } from "./env";

describe("loadApiEnv", () => {
  it("loads valid real provider configuration", () => {
    const env = loadApiEnv({
      API_HOST: "127.0.0.1",
      API_PORT: "43110",
      ASR_PROVIDER: "openai",
      ASR_MODEL: "gpt-4o-transcribe",
      ASR_BASE_URL: "https://api.openai.com/v1",
      ASR_API_KEY: "asr-secret",
      ASR_LANGUAGE: "auto",
      LLM_PROVIDER: "openai-compatible",
      LLM_MODEL: "gpt-4o",
      LLM_BASE_URL: "https://api.openai.com/v1",
      LLM_API_KEY: "llm-secret",
      LLM_TEMPERATURE: "0.2"
    });

    expect(env.asr.model).toBe("gpt-4o-transcribe");
    expect(env.llm.temperature).toBe(0.2);
  });

  it("rejects missing ASR key without logging the key value", () => {
    expect(() =>
      loadApiEnv({
        API_HOST: "127.0.0.1",
        API_PORT: "43110",
        ASR_PROVIDER: "openai",
        ASR_MODEL: "gpt-4o-transcribe",
        ASR_BASE_URL: "https://api.openai.com/v1",
        ASR_LANGUAGE: "auto",
        LLM_PROVIDER: "openai-compatible",
        LLM_MODEL: "gpt-4o",
        LLM_BASE_URL: "https://api.openai.com/v1",
        LLM_API_KEY: "llm-secret",
        LLM_TEMPERATURE: "0.2"
      })
    ).toThrow("config.asr_missing");
  });
});
```

- [ ] **Step 2: Run env tests and verify RED**

Run:

```bash
pnpm test services/api/src/config/env.test.ts
```

Expected: FAIL with import error for `./env`.

- [ ] **Step 3: Implement env loader**

Create `services/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

Create `services/api/src/config/env.ts`:

```ts
import { z } from "zod";

const EnvSchema = z.object({
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(43110),
  ASR_PROVIDER: z.literal("openai"),
  ASR_MODEL: z.literal("gpt-4o-transcribe"),
  ASR_BASE_URL: z.string().url(),
  ASR_API_KEY: z.string().min(1, "config.asr_missing"),
  ASR_LANGUAGE: z.string().default("auto"),
  LLM_PROVIDER: z.literal("openai-compatible"),
  LLM_MODEL: z.string().min(1, "config.llm_missing"),
  LLM_BASE_URL: z.string().url(),
  LLM_API_KEY: z.string().min(1, "config.llm_missing"),
  LLM_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.2)
});

export type ApiEnv = ReturnType<typeof loadApiEnv>;

export function loadApiEnv(input: NodeJS.ProcessEnv) {
  const parsed = EnvSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "config.invalid");
  }

  return {
    server: {
      host: parsed.data.API_HOST,
      port: parsed.data.API_PORT
    },
    asr: {
      provider: parsed.data.ASR_PROVIDER,
      model: parsed.data.ASR_MODEL,
      baseUrl: parsed.data.ASR_BASE_URL,
      apiKey: parsed.data.ASR_API_KEY,
      language: parsed.data.ASR_LANGUAGE
    },
    llm: {
      provider: parsed.data.LLM_PROVIDER,
      model: parsed.data.LLM_MODEL,
      baseUrl: parsed.data.LLM_BASE_URL,
      apiKey: parsed.data.LLM_API_KEY,
      temperature: parsed.data.LLM_TEMPERATURE
    }
  } as const;
}
```

- [ ] **Step 4: Create provider interfaces**

Create `services/api/src/providers/asr/ASRProvider.ts`:

```ts
export interface ASRInput {
  audio: Buffer;
  filename: string;
  mimeType: "audio/webm" | "audio/wav";
  language: string;
  prompt?: string;
}

export interface ASRResult {
  rawText: string;
  language: string;
  provider: string;
  durationMs?: number;
}

export interface ASRProvider {
  transcribe(input: ASRInput): Promise<ASRResult>;
}
```

Create `services/api/src/providers/llm/LLMProvider.ts`:

```ts
export interface LLMMessage {
  role: "system" | "user";
  content: string;
}

export interface LLMCompletionInput {
  messages: LLMMessage[];
  temperature: number;
  responseFormat: "json_object";
}

export interface LLMCompletionResult {
  content: string;
  provider: string;
  durationMs?: number;
}

export interface LLMProvider {
  complete(input: LLMCompletionInput): Promise<LLMCompletionResult>;
}
```

- [ ] **Step 5: Run env tests and typecheck**

Run:

```bash
pnpm test services/api/src/config/env.test.ts
pnpm --filter @echo/api typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit backend config**

Run:

```bash
git add services/api
git commit -m "feat: add api provider configuration"
```

Expected: commit created.

## Task 4: OpenAI ASR Provider

**Files:**
- Create: `services/api/src/providers/asr/OpenAITranscribeProvider.ts`
- Test: `services/api/src/providers/asr/OpenAITranscribeProvider.test.ts`

- [ ] **Step 1: Write failing ASR provider tests**

Create `services/api/src/providers/asr/OpenAITranscribeProvider.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { OpenAITranscribeProvider } from "./OpenAITranscribeProvider";

describe("OpenAITranscribeProvider", () => {
  it("sends audio to the configured transcription model", async () => {
    const create = vi.fn().mockResolvedValue({ text: "hello world" });
    const provider = new OpenAITranscribeProvider({
      apiKey: "secret",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-transcribe",
      client: {
        audio: {
          transcriptions: {
            create
          }
        }
      }
    });

    const result = await provider.transcribe({
      audio: Buffer.from("audio"),
      filename: "dictation.webm",
      mimeType: "audio/webm",
      language: "auto",
      prompt: "User dictionary: Echo"
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-transcribe",
        prompt: "User dictionary: Echo"
      })
    );
    expect(result.rawText).toBe("hello world");
    expect(result.provider).toBe("openai:gpt-4o-transcribe");
  });

  it("maps provider failure to server.asr_failed", async () => {
    const create = vi.fn().mockRejectedValue(new Error("network down"));
    const provider = new OpenAITranscribeProvider({
      apiKey: "secret",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-transcribe",
      client: {
        audio: {
          transcriptions: {
            create
          }
        }
      }
    });

    await expect(
      provider.transcribe({
        audio: Buffer.from("audio"),
        filename: "dictation.wav",
        mimeType: "audio/wav",
        language: "auto"
      })
    ).rejects.toThrow("server.asr_failed");
  });
});
```

- [ ] **Step 2: Run ASR provider tests and verify RED**

Run:

```bash
pnpm test services/api/src/providers/asr/OpenAITranscribeProvider.test.ts
```

Expected: FAIL with import error for `./OpenAITranscribeProvider`.

- [ ] **Step 3: Implement OpenAI transcription adapter**

Create `services/api/src/providers/asr/OpenAITranscribeProvider.ts`.

Implementation requirements:

- Constructor accepts `{ apiKey, baseUrl, model, client }`.
- If `client` is absent, create `new OpenAI({ apiKey, baseURL: baseUrl })`.
- Convert `Buffer` into a `File` with the uploaded filename and MIME type.
- Call `client.audio.transcriptions.create({ file, model, prompt })`.
- Omit `language` when config is `auto`.
- Return `{ rawText: response.text, language: input.language, provider: "openai:gpt-4o-transcribe" }`.
- Catch provider errors and throw `new Error("server.asr_failed")`.

- [ ] **Step 4: Run ASR provider tests and typecheck**

Run:

```bash
pnpm test services/api/src/providers/asr/OpenAITranscribeProvider.test.ts
pnpm --filter @echo/api typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit ASR provider**

Run:

```bash
git add services/api/src/providers/asr
git commit -m "feat: add OpenAI transcription provider"
```

Expected: commit created.

## Task 5: LLM Refinement Prompt, Provider, and Validator

**Files:**
- Create: `services/api/src/refiner/buildDictationPrompt.ts`
- Test: `services/api/src/refiner/buildDictationPrompt.test.ts`
- Create: `services/api/src/providers/llm/OpenAICompatibleLLMProvider.ts`
- Test: `services/api/src/providers/llm/OpenAICompatibleLLMProvider.test.ts`
- Create: `services/api/src/refiner/validateRefinedResult.ts`
- Test: `services/api/src/refiner/validateRefinedResult.test.ts`

- [ ] **Step 1: Write failing prompt tests**

Create `services/api/src/refiner/buildDictationPrompt.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildDictationPrompt } from "./buildDictationPrompt";

describe("buildDictationPrompt", () => {
  it("requires cleanup, self-correction handling, formatting, and no command execution", () => {
    const prompt = buildDictationPrompt({
      rawText: "um tomorrow at seven no make it three",
      language: "auto",
      context: {
        app_name: "TextEdit",
        bundle_id: "com.apple.TextEdit",
        window_title: "Untitled",
        writable: true,
        selection_present: false,
        nearby_text: ""
      },
      dictionary: [{ term: "Echo", aliases: [], case_sensitive: true, source: "manual" }],
      preferences: { style: "balanced", output_language: "follow_input", format_lists: true }
    });

    expect(prompt.system).toContain("Remove filler words");
    expect(prompt.system).toContain("Resolve self-corrections");
    expect(prompt.system).toContain("Do not execute commands");
    expect(prompt.user).toContain("Echo");
    expect(prompt.user).toContain("um tomorrow at seven no make it three");
  });
});
```

- [ ] **Step 2: Run prompt tests and verify RED**

Run:

```bash
pnpm test services/api/src/refiner/buildDictationPrompt.test.ts
```

Expected: FAIL with import error for `./buildDictationPrompt`.

- [ ] **Step 3: Implement prompt builder**

Create `services/api/src/refiner/buildDictationPrompt.ts`.

The returned object must be:

```ts
export interface DictationPrompt {
  system: string;
  user: string;
}
```

System prompt must require:

- Remove filler words and hesitations.
- Remove repeated words and duplicate phrases.
- Resolve self-corrections in English and Chinese.
- Add punctuation, capitalization, paragraphs, and list structure.
- Improve clarity only when intent is clear.
- Preserve names, numbers, dates, product names, technical terms, dictionary terms, and intentional repetition.
- Do not add facts.
- Do not execute commands.
- Do not translate unless the input itself is translation content.
- Return JSON only with keys `refined_text`, `language`, `edits`, `risk`, and `warnings`.

- [ ] **Step 4: Write failing LLM provider tests**

Create `services/api/src/providers/llm/OpenAICompatibleLLMProvider.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { OpenAICompatibleLLMProvider } from "./OpenAICompatibleLLMProvider";

describe("OpenAICompatibleLLMProvider", () => {
  it("posts chat completions to the configured base URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "{\"refined_text\":\"Tomorrow at three.\",\"language\":\"en\",\"edits\":[],\"risk\":\"low\",\"warnings\":[]}" } }]
      })
    });
    const provider = new OpenAICompatibleLLMProvider({
      apiKey: "secret",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      fetchImpl
    });

    const result = await provider.complete({
      messages: [{ role: "system", content: "Return JSON" }, { role: "user", content: "raw" }],
      temperature: 0.2,
      responseFormat: "json_object"
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret"
        })
      })
    );
    expect(result.content).toContain("Tomorrow at three");
  });

  it("maps provider errors to server.refine_failed", async () => {
    const provider = new OpenAICompatibleLLMProvider({
      apiKey: "secret",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "bad" })
    });

    await expect(
      provider.complete({
        messages: [{ role: "system", content: "Return JSON" }, { role: "user", content: "raw" }],
        temperature: 0.2,
        responseFormat: "json_object"
      })
    ).rejects.toThrow("server.refine_failed");
  });
});
```

- [ ] **Step 5: Implement OpenAI-compatible LLM provider**

Create `services/api/src/providers/llm/OpenAICompatibleLLMProvider.ts`.

Implementation requirements:

- POST to `${baseUrl}/chat/completions` with duplicate slashes normalized.
- Send `model`, `messages`, `temperature`, and `response_format: { type: "json_object" }`.
- Use `Authorization: Bearer ${apiKey}`.
- Return the first choice message content.
- Throw `server.refine_failed` for non-2xx, empty content, invalid JSON response envelopes, and fetch errors.

- [ ] **Step 6: Write failing validator tests**

Create `services/api/src/refiner/validateRefinedResult.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateRefinedResult } from "./validateRefinedResult";

describe("validateRefinedResult", () => {
  it("accepts a safe refinement", () => {
    const result = validateRefinedResult({
      rawText: "um tomorrow at seven no make it three",
      llmContent: "{\"refined_text\":\"Tomorrow at three.\",\"language\":\"en\",\"edits\":[\"resolved correction\"],\"risk\":\"low\",\"warnings\":[]}",
      dictionaryTerms: []
    });

    expect(result.refinedText).toBe("Tomorrow at three.");
    expect(result.risk).toBe("low");
  });

  it("rejects empty refined text when raw text exists", () => {
    expect(() =>
      validateRefinedResult({
        rawText: "hello",
        llmContent: "{\"refined_text\":\"\",\"language\":\"en\",\"edits\":[],\"risk\":\"low\",\"warnings\":[]}",
        dictionaryTerms: []
      })
    ).toThrow("server.refine_failed");
  });

  it("raises risk when dictionary terms disappear", () => {
    const result = validateRefinedResult({
      rawText: "Echo should remember this",
      llmContent: "{\"refined_text\":\"It should remember this.\",\"language\":\"en\",\"edits\":[],\"risk\":\"low\",\"warnings\":[]}",
      dictionaryTerms: ["Echo"]
    });

    expect(result.risk).toBe("medium");
    expect(result.warnings).toContain("dictionary_term_missing:Echo");
  });
});
```

- [ ] **Step 7: Implement validator**

Create `services/api/src/refiner/validateRefinedResult.ts`.

Implementation requirements:

- Parse LLM JSON content.
- Require non-empty `refined_text` when raw text is non-empty.
- Normalize risk to `low`, `medium`, or `high`.
- Add `dictionary_term_missing:${term}` warnings for missing case-sensitive dictionary terms.
- Return `{ refinedText, language, edits, risk, warnings }`.
- Throw `server.refine_failed` for invalid JSON or invalid shape.

- [ ] **Step 8: Run refiner tests and typecheck**

Run:

```bash
pnpm test services/api/src/refiner services/api/src/providers/llm
pnpm --filter @echo/api typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit refinement layer**

Run:

```bash
git add services/api/src/refiner services/api/src/providers/llm
git commit -m "feat: add dictation refinement provider"
```

Expected: commit created.

## Task 6: Dictation HTTP API

**Files:**
- Create: `services/api/src/server.ts`
- Create: `services/api/src/index.ts`
- Create: `services/api/src/dictation/dictationRoute.ts`
- Test: `services/api/src/dictation/dictationRoute.test.ts`
- Create: `services/api/src/test/fixtures.ts`

- [ ] **Step 1: Write failing route tests**

Create `services/api/src/dictation/dictationRoute.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildServer } from "../server";

function multipartBody(parts: Array<{ name: string; value: string } | { name: string; filename: string; contentType: string; value: string }>) {
  const boundary = "----echo-test-boundary";
  const body = parts
    .map((part) => {
      if ("filename" in part) {
        return [
          `--${boundary}`,
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"`,
          `Content-Type: ${part.contentType}`,
          "",
          part.value
        ].join("\r\n");
      }

      return [`--${boundary}`, `Content-Disposition: form-data; name="${part.name}"`, "", part.value].join("\r\n");
    })
    .concat(`--${boundary}--`)
    .join("\r\n");

  return {
    body,
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`
    }
  };
}

describe("POST /v1/dictation/process", () => {
  it("returns refined text with provider metadata", async () => {
    const app = buildServer({
      asr: {
        transcribe: async () => ({
          rawText: "um tomorrow at seven no make it three",
          language: "en",
          provider: "openai:gpt-4o-transcribe",
          durationMs: 12
        })
      },
      llm: {
        complete: async () => ({
          content: "{\"refined_text\":\"Tomorrow at three.\",\"language\":\"en\",\"edits\":[\"resolved correction\"],\"risk\":\"low\",\"warnings\":[]}",
          provider: "openai-compatible:gpt-4o",
          durationMs: 8
        })
      }
    });

    const multipart = multipartBody([
      { name: "session_id", value: "session-1" },
      { name: "audio_format", value: "webm" },
      { name: "duration_ms", value: "1200" },
      { name: "language", value: "auto" },
      {
        name: "context",
        value: JSON.stringify({
          app_name: "TextEdit",
          bundle_id: "com.apple.TextEdit",
          window_title: "Untitled",
          writable: true,
          selection_present: false,
          nearby_text: ""
        })
      },
      {
        name: "dictionary",
        value: JSON.stringify([{ term: "Echo", aliases: [], case_sensitive: true, source: "manual" }])
      },
      {
        name: "preferences",
        value: JSON.stringify({ style: "balanced", output_language: "follow_input", format_lists: true })
      },
      { name: "audio", filename: "dictation.webm", contentType: "audio/webm", value: "audio-bytes" }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/dictation/process",
      payload: multipart.body,
      headers: multipart.headers
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().refined_text).toBe("Tomorrow at three.");
    expect(response.json().provider.asr).toBe("openai:gpt-4o-transcribe");
  });
});
```

- [ ] **Step 2: Run route tests and verify RED**

Run:

```bash
pnpm test services/api/src/dictation/dictationRoute.test.ts
```

Expected: FAIL with import error for `../server` or missing route.

- [ ] **Step 3: Implement Fastify server and dictation route**

Create `services/api/src/server.ts`:

- Export `buildServer({ asr, llm })`.
- Register `@fastify/multipart`.
- Register `POST /v1/dictation/process`.
- Add `GET /health` returning `{ ok: true }`.

Create `services/api/src/dictation/dictationRoute.ts`:

- Read multipart fields.
- Require one audio file.
- Parse `context`, `dictionary`, and `preferences` as JSON.
- Validate request fields with shared schemas.
- Build ASR prompt from dictionary terms.
- Call ASR provider.
- Build LLM prompt.
- Call LLM provider.
- Validate refined result.
- Return success contract.
- Map known errors to the shared error response shape.

Create `services/api/src/index.ts`:

- Load `.env` with `dotenv/config`.
- Load env with `loadApiEnv(process.env)`.
- Construct OpenAI ASR provider.
- Construct LLM provider.
- Start Fastify on configured host and port.
- Log only host, port, and provider names. Do not log keys, audio, raw text, or refined text.

- [ ] **Step 4: Run API tests and typecheck**

Run:

```bash
pnpm test services/api/src/dictation/dictationRoute.test.ts
pnpm --filter @echo/api typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit API route**

Run:

```bash
git add services/api/src/server.ts services/api/src/index.ts services/api/src/dictation services/api/src/test
git commit -m "feat: add dictation processing api"
```

Expected: commit created.

## Task 7: Desktop Storage Layer

**Files:**
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/src/main/appPaths.ts`
- Create: `apps/desktop/src/main/storage/database.ts`
- Create: `apps/desktop/src/main/storage/historyRepository.ts`
- Test: `apps/desktop/src/main/storage/historyRepository.test.ts`
- Create: `apps/desktop/src/main/storage/settingsRepository.ts`
- Test: `apps/desktop/src/main/storage/settingsRepository.test.ts`
- Create: `apps/desktop/src/main/storage/dictionaryRepository.ts`
- Test: `apps/desktop/src/main/storage/dictionaryRepository.test.ts`

- [ ] **Step 1: Write failing repository tests**

Create tests for:

- Inserting a completed dictation history row with raw/refined text, provider metadata, insertion status, timing JSON, and app context.
- Reading history ordered by newest first.
- Saving and reading retention settings.
- Saving manual dictionary terms and searching them case-insensitively.

Test setup must create a temporary SQLite database path under `os.tmpdir()` and delete it after each test.

- [ ] **Step 2: Run storage tests and verify RED**

Run:

```bash
pnpm test apps/desktop/src/main/storage
```

Expected: FAIL with import errors for repository files.

- [ ] **Step 3: Implement desktop TypeScript config**

Create `apps/desktop/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist",
    "types": ["node", "vite/client"]
  },
  "include": ["src", "electron.vite.config.ts"]
}
```

- [ ] **Step 4: Implement SQLite schema and repositories**

Create `database.ts`:

- Open a `better-sqlite3` database.
- Apply `CREATE TABLE IF NOT EXISTS` migrations for `dictation_history`, `settings`, and `dictionary_terms`.
- Enable WAL mode.

Create repository modules:

- `historyRepository.ts`: `insertHistoryRow`, `listHistory`, `updateInsertionStatus`, `deleteHistoryRow`.
- `settingsRepository.ts`: `getSettings`, `saveSettings`, `getDefaultSettings`.
- `dictionaryRepository.ts`: `addDictionaryTerm`, `listDictionaryTerms`, `searchDictionaryTerms`, `deleteDictionaryTerm`.

Use the field names from spec section 11 exactly.

- [ ] **Step 5: Run storage tests and typecheck**

Run:

```bash
pnpm test apps/desktop/src/main/storage
pnpm --filter @echo/desktop typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit desktop storage**

Run:

```bash
git add apps/desktop/src/main/storage apps/desktop/src/main/appPaths.ts apps/desktop/tsconfig.json
git commit -m "feat: add desktop local storage"
```

Expected: commit created.

## Task 8: Desktop Main Process, IPC, Shortcut, Context, and Insertion

**Files:**
- Create: `apps/desktop/electron.vite.config.ts`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/src/main/index.ts`
- Create: `apps/desktop/src/main/ipc.ts`
- Create: `apps/desktop/src/main/platform/shortcut.ts`
- Create: `apps/desktop/src/main/platform/context.ts`
- Test: `apps/desktop/src/main/platform/context.test.ts`
- Create: `apps/desktop/src/main/platform/insertion.ts`
- Test: `apps/desktop/src/main/platform/insertion.test.ts`
- Create: `apps/desktop/src/preload/index.ts`

- [ ] **Step 1: Write failing context and insertion tests**

Context test:

```ts
import { describe, expect, it } from "vitest";
import { buildFallbackContext } from "./context";

describe("buildFallbackContext", () => {
  it("uses the active app name when native context is unavailable", () => {
    const context = buildFallbackContext({ appName: "TextEdit" });
    expect(context.app_name).toBe("TextEdit");
    expect(context.writable).toBe(true);
  });
});
```

Insertion test:

```ts
import { describe, expect, it, vi } from "vitest";
import { pasteTextWithClipboardFallback } from "./insertion";

describe("pasteTextWithClipboardFallback", () => {
  it("writes text to clipboard and invokes paste", async () => {
    const clipboard = { readText: vi.fn(() => "before"), writeText: vi.fn() };
    const runPaste = vi.fn().mockResolvedValue(undefined);

    const result = await pasteTextWithClipboardFallback("hello", { clipboard, runPaste });

    expect(clipboard.writeText).toHaveBeenCalledWith("hello");
    expect(runPaste).toHaveBeenCalled();
    expect(result).toEqual({ method: "clipboard_paste", status: "inserted" });
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm test apps/desktop/src/main/platform
```

Expected: FAIL with import errors.

- [ ] **Step 3: Implement platform modules**

`shortcut.ts`:

- Default accelerator: `Alt+Space`.
- Register global shortcut with Electron `globalShortcut`.
- Return conflict result if registration fails.
- Allow later settings-driven shortcut replacement.

`context.ts`:

- Export `captureContext()`.
- First implementation returns active app fallback when native Accessibility context is unavailable.
- Keep shape compatible with shared `DictationContextSchema`.

`insertion.ts`:

- Export `pasteTextWithClipboardFallback(text, deps)`.
- Write text to Electron clipboard.
- Run macOS paste command with `osascript`:

```applescript
tell application "System Events" to keystroke "v" using command down
```

- Return `{ method: "clipboard_paste", status: "inserted" }` on success.
- Return `{ method: "clipboard", status: "copied" }` when paste fails after clipboard write.

- [ ] **Step 4: Implement preload and IPC skeleton**

`preload/index.ts` exposes `window.echo` with:

- `getAppState`
- `startDictation`
- `stopDictation`
- `cancelDictation`
- `listHistory`
- `listDictionaryTerms`
- `saveSettings`

`ipc.ts` wires these to main-process handlers.

- [ ] **Step 5: Implement Electron main window setup**

`index.ts`:

- Enforce single instance.
- Create Hub window.
- Create overlay window as frameless transparent always-on-top window.
- Register shortcut after app ready.
- Initialize database and repositories.
- Register IPC.

- [ ] **Step 6: Run platform tests and typecheck**

Run:

```bash
pnpm test apps/desktop/src/main/platform
pnpm --filter @echo/desktop typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit main process foundation**

Run:

```bash
git add apps/desktop/electron.vite.config.ts apps/desktop/index.html apps/desktop/src/main apps/desktop/src/preload
git commit -m "feat: add desktop main process foundation"
```

Expected: commit created.

## Task 9: Dictation Session Controller and Backend Client

**Files:**
- Create: `apps/desktop/src/main/dictation/sessionController.ts`
- Test: `apps/desktop/src/main/dictation/sessionController.test.ts`
- Create: `apps/desktop/src/main/dictation/backendClient.ts`
- Test: `apps/desktop/src/main/dictation/backendClient.test.ts`

- [ ] **Step 1: Write failing session controller tests**

Test these behaviors:

- Starting from idle creates a session, captures context, shows recording overlay, and requests recorder start.
- Stopping from recording sends audio to backend, enters processing, inserts refined text, and writes history.
- Backend failure records an error history row and shows overlay error.
- No production path returns fabricated transcription text.

- [ ] **Step 2: Run session tests and verify RED**

Run:

```bash
pnpm test apps/desktop/src/main/dictation
```

Expected: FAIL with import errors.

- [ ] **Step 3: Implement backend client**

`backendClient.ts`:

- Export `processDictation({ audio, audioFormat, durationMs, context, dictionary, preferences })`.
- POST multipart form to `${API_BASE_URL}/v1/dictation/process`.
- Send metadata fields exactly as specified.
- Parse success and error responses with shared schemas.
- Throw error codes from server responses.

- [ ] **Step 4: Implement session controller**

`sessionController.ts`:

- Own shared state machine.
- Start session on shortcut if idle.
- Stop session on shortcut if recording.
- Cancel session if recording or finalizing.
- Persist local audio path when recording returns a file.
- Include dictionary terms in backend request.
- Store raw/refined text, provider metadata, timing, app context, and insertion status in history.
- Show unrefined raw text only in error recovery when refinement fails.

- [ ] **Step 5: Run session tests and typecheck**

Run:

```bash
pnpm test apps/desktop/src/main/dictation
pnpm --filter @echo/desktop typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit session controller**

Run:

```bash
git add apps/desktop/src/main/dictation
git commit -m "feat: add dictation session controller"
```

Expected: commit created.

## Task 10: Renderer Recording, Overlay, and Hub UI

**Files:**
- Create: `apps/desktop/src/renderer/main.tsx`
- Create: `apps/desktop/src/renderer/App.tsx`
- Create: `apps/desktop/src/renderer/styles.css`
- Create: `apps/desktop/src/renderer/api/desktopApi.ts`
- Create: `apps/desktop/src/renderer/recording/audioRecorder.ts`
- Test: `apps/desktop/src/renderer/recording/audioRecorder.test.ts`
- Create: `apps/desktop/src/renderer/components/Overlay.tsx`
- Test: `apps/desktop/src/renderer/components/Overlay.test.tsx`
- Create: `apps/desktop/src/renderer/components/HubLayout.tsx`
- Create: `apps/desktop/src/renderer/pages/HomePage.tsx`
- Create: `apps/desktop/src/renderer/pages/HistoryPage.tsx`
- Create: `apps/desktop/src/renderer/pages/DictionaryPage.tsx`
- Create: `apps/desktop/src/renderer/pages/SettingsPage.tsx`

- [ ] **Step 1: Use frontend-design before UI implementation**

Before editing renderer UI files, read and apply the `frontend-design` skill because this task creates a production desktop interface. The visual target is a quiet macOS utility: dense, clear, not a marketing landing page.

- [ ] **Step 2: Write failing audio recorder tests**

Test these behaviors:

- Chooses `audio/webm` when `MediaRecorder.isTypeSupported("audio/webm")` is true.
- Falls back to `audio/wav` wrapper only when webm is unavailable.
- Returns duration and Blob after stop.
- Emits level samples for waveform.

- [ ] **Step 3: Implement audio recorder**

`audioRecorder.ts`:

- Use `navigator.mediaDevices.getUserMedia({ audio: true })`.
- Use `MediaRecorder`.
- Collect chunks until stop.
- Track duration with `performance.now()`.
- Use `AudioContext` analyser for waveform level.
- Return `{ blob, audioFormat, durationMs }`.

- [ ] **Step 4: Write failing overlay tests**

Create tests verifying:

- Recording state shows elapsed time, waveform label, Cancel, and Finish.
- Processing state shows explicit "Processing" text.
- Error state shows Retry, Copy, and Dismiss actions.

- [ ] **Step 5: Implement Overlay component**

Overlay requirements:

- Bottom pill position.
- Distinct states: recording, finalizing, processing, inserting, complete, error.
- No hidden icon-only buttons without `aria-label`.
- Text labels must fit in the pill at narrow widths.

- [ ] **Step 6: Implement Hub pages**

Home:

- Main shortcut text: "Press once to start, press again to finish."
- Provider status card without secrets.
- Recent dictation and usage counters.

History:

- Retention control at top.
- Dictation rows with timestamp, app, preview, provider, insertion status, Retry, Copy, Delete.

Dictionary:

- Manual add flow.
- Search.
- Source chip for manual or learned.

Settings:

- Shortcut.
- Microphone.
- Language.
- Provider status.
- Retention.
- Launch and Dock toggles.

- [ ] **Step 7: Run renderer tests, typecheck, and build**

Run:

```bash
pnpm test apps/desktop/src/renderer
pnpm --filter @echo/desktop typecheck
pnpm --filter @echo/desktop build
```

Expected: PASS.

- [ ] **Step 8: Commit renderer UI**

Run:

```bash
git add apps/desktop/src/renderer
git commit -m "feat: add desktop dictation UI"
```

Expected: commit created.

## Task 11: Local Development Wiring and Provider Smoke Tests

**Files:**
- Modify: `package.json`
- Modify: `services/api/package.json`
- Create: `services/api/src/providers/realProviderSmoke.test.ts`
- Create: `docs/development/local-real-provider.md`

- [ ] **Step 1: Write real provider smoke test**

Create `services/api/src/providers/realProviderSmoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadApiEnv } from "../config/env";
import { OpenAITranscribeProvider } from "./asr/OpenAITranscribeProvider";
import { OpenAICompatibleLLMProvider } from "./llm/OpenAICompatibleLLMProvider";

const runReal = process.env.RUN_REAL_PROVIDER_TESTS === "1";

describe.skipIf(!runReal)("real providers", () => {
  it("requires local provider configuration", () => {
    const env = loadApiEnv(process.env);
    expect(env.asr.model).toBe("gpt-4o-transcribe");
    expect(env.llm.model.length).toBeGreaterThan(0);
  });

  it("constructs real provider instances", () => {
    const env = loadApiEnv(process.env);
    const asr = new OpenAITranscribeProvider(env.asr);
    const llm = new OpenAICompatibleLLMProvider(env.llm);
    expect(asr).toBeDefined();
    expect(llm).toBeDefined();
  });
});
```

This test must be skipped unless `RUN_REAL_PROVIDER_TESTS=1`.

- [ ] **Step 2: Write local development guide**

Create `docs/development/local-real-provider.md` with:

- Copy `.env.example` to `.env`.
- Fill `ASR_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`, and `LLM_API_KEY`.
- Start backend: `pnpm dev:api`.
- Start desktop: `pnpm dev:desktop`.
- Do not commit `.env`.
- Real provider tests create cost only when `RUN_REAL_PROVIDER_TESTS=1`.

- [ ] **Step 3: Run standard verification**

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
git check-ignore -v .env
```

Expected:

- Typecheck passes.
- Tests pass.
- Build passes.
- `.env` is ignored by `.gitignore`.

- [ ] **Step 4: Run optional real provider verification when keys exist**

Run only when `.env` has valid keys and the user approves provider cost:

```bash
RUN_REAL_PROVIDER_TESTS=1 pnpm --filter @echo/api test:real
```

Expected: provider construction test passes. Add a fixture-audio ASR test only after a non-sensitive audio fixture is committed.

- [ ] **Step 5: Commit development wiring**

Run:

```bash
git add package.json services/api/package.json services/api/src/providers/realProviderSmoke.test.ts docs/development/local-real-provider.md
git commit -m "chore: document real provider development flow"
```

Expected: commit created.

## Task 12: Manual macOS Smoke Test

**Files:**
- Create: `docs/development/manual-smoke-test.md`

- [ ] **Step 1: Document smoke protocol**

Create `docs/development/manual-smoke-test.md` with this checklist:

```markdown
# Echo Manual macOS Smoke Test

## Preconditions

- `.env` contains valid real provider credentials.
- Backend is running with `pnpm dev:api`.
- Desktop app is running with `pnpm dev:desktop`.
- Microphone permission is granted.
- Accessibility permission is granted for the terminal or app host running Electron.

## Test

- [ ] Open TextEdit and focus a blank document.
- [ ] Press the configured dictation shortcut once.
- [ ] Confirm the overlay shows recording state with elapsed time and controls.
- [ ] Say: "Let's meet tomorrow at seven, no actually make that three."
- [ ] Press the shortcut again.
- [ ] Confirm the overlay shows explicit processing text.
- [ ] Confirm TextEdit receives: "Let's meet tomorrow at three."
- [ ] Confirm History has a row with raw text, refined text, app name, provider metadata, and insertion status.
- [ ] Confirm no provider key appears in logs or UI.
- [ ] Run `git status --short` and confirm `.env` and local recordings are not staged.
```

- [ ] **Step 2: Run manual smoke test**

Run:

```bash
pnpm dev:api
pnpm dev:desktop
```

Then perform the checklist in TextEdit.

Expected:

- Refined text is inserted, or copied to clipboard with a clear insertion fallback error.
- History row is created.
- Provider metadata is visible without secrets.

- [ ] **Step 3: Fix smoke-test failures with TDD**

For any failure:

- Add or update the smallest automated test that reproduces the failure.
- Run the test and verify it fails.
- Implement the smallest fix.
- Run the test and full relevant verification.
- Commit the fix.

- [ ] **Step 4: Commit smoke test documentation**

Run:

```bash
git add docs/development/manual-smoke-test.md
git commit -m "docs: add macOS smoke test"
```

Expected: commit created.

## Final Verification

- [ ] **Step 1: Run complete local verification**

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
git diff --check
git status --short
```

Expected:

- Typecheck passes.
- Tests pass.
- Build passes.
- Diff check has no whitespace errors.
- Only intentional files are changed or the tree is clean.

- [ ] **Step 2: Run real provider verification with user-approved keys**

Run only when `.env` is configured:

```bash
RUN_REAL_PROVIDER_TESTS=1 pnpm --filter @echo/api test:real
```

Expected: real provider tests pass. If unavailable because keys are missing, report that exact blocker.

- [ ] **Step 3: Run manual smoke test**

Follow `docs/development/manual-smoke-test.md`.

Expected: TextEdit insertion or clipboard fallback, local History row, no secrets in UI/logs.

- [ ] **Step 4: Push final checkpoint**

Run:

```bash
git push
```

Expected: branch pushed.

## Spec Coverage Audit

- Real provider only: Tasks 3, 4, 5, 6, and 11 enforce real provider configuration and keep test doubles scoped to automated tests.
- OpenAI `gpt-4o-transcribe`: Tasks 3 and 4 lock ASR provider configuration and adapter behavior.
- OpenAI-compatible LLM: Tasks 3 and 5 implement configurable LLM refinement.
- Full-audio HTTP processing: Tasks 6, 9, and 10 wire recorded audio to `/v1/dictation/process`.
- Dictation cleanup features: Task 5 prompt and validator cover filler removal, repetition removal, self-corrections, punctuation, paragraphs, lists, clarity, and preservation rules.
- Hub, History, Dictionary, Settings: Task 10 implements required UI surfaces.
- Overlay states: Task 10 implements and tests recording, finalizing, processing, inserting, complete, and error states.
- Shortcut, recording, context, insertion: Tasks 8, 9, and 10 implement the macOS app loop with clipboard paste fallback.
- Local storage: Task 7 implements SQLite history, settings, and dictionary.
- Privacy and secrets: Tasks 1, 3, 8, 11, and final verification cover `.env`, no renderer keys, and no secret logging.
- Verification: Tasks 2 through 12 use TDD and include full local, optional real provider, and manual macOS smoke checks.
