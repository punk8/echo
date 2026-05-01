# Local Real Provider Development

Echo does not ship a production mock provider. Local development expects a real ASR provider and a real OpenAI-compatible LLM provider.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill `ASR_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`, and `LLM_API_KEY`.
3. Keep `ASR_PROVIDER=openai` and `ASR_MODEL=gpt-4o-transcribe`.
4. Do not commit `.env`.

## Run

Start the desktop app:

```bash
pnpm dev
```

When `API_BASE_URL` is not set, the Electron main process checks `http://127.0.0.1:43110/health` and starts the local API service automatically if nothing is already listening there.

To run the backend manually for API-only work:

```bash
pnpm dev:api
```

To point the desktop app at a user-managed or hosted backend, set `API_BASE_URL`; in that mode the desktop app does not spawn a local API process.

To run only the desktop app while still allowing it to manage the local API:

```bash
pnpm dev:desktop
```

The desktop dev and preview scripts rebuild `better-sqlite3` for Electron before launching. If you later need to run Node/Vitest storage tests in the same checkout, rebuild native modules for Node again:

```bash
pnpm --filter @echo/desktop rebuild:native:node
```

The desktop app calls `http://127.0.0.1:43110` by default. Override host and port with `API_HOST` and `API_PORT`, or override the complete backend URL with `API_BASE_URL`.

## Verification

Standard checks do not call paid providers:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Real provider smoke tests run only when explicitly enabled:

```bash
RUN_REAL_PROVIDER_TESTS=1 pnpm --filter @echo/api test:real
```

Those tests may create provider cost. Run them only with valid local keys and when you intend to verify live provider configuration.
