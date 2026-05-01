# Local Real Provider Development

Echo does not ship a production mock provider. Local development expects a real ASR provider and a real OpenAI-compatible LLM provider.

## Setup

1. Copy `.env.example` to `.env`.
2. Fill `ASR_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`, and `LLM_API_KEY`.
3. Keep `ASR_PROVIDER=openai` and `ASR_MODEL=gpt-4o-transcribe`.
4. Do not commit `.env`.

## Run

Start the backend:

```bash
pnpm dev:api
```

Start the desktop app:

```bash
pnpm dev:desktop
```

Or run both:

```bash
pnpm dev
```

The desktop app calls `http://127.0.0.1:43110` by default. Override with `API_BASE_URL` when needed.

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
