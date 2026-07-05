# ARCHITECTURE.md — TokenFlow AI

Last updated: 2026-07-04
Version: v1.1.0 (multi-provider)

---

## System Overview

TokenFlow AI intercepts every prompt before it reaches the model. It collects workspace context, optimizes it, routes it through a pluggable provider pipeline, and surfaces real token/cost savings.

```
Your Workspace
      │
      ▼
WorkspaceReader (git diff, active file, imports, README)
      │
      ▼
ContextBuilder (serializes WorkspaceContext → markdown)
      │
      ▼
TokenOptimizer (4-stage pipeline — typically 60–70% reduction)
      │
      ▼
ProviderRegistry → ProviderFactory.create()
      │
      ▼
LoggingMiddleware
      │
      ▼
RetryMiddleware (3 attempts, exponential backoff)
      │
      ▼
MetricsMiddleware → ProviderEventBus
      │                      │
      ▼               StatusBar / TokenMonitorPanel
┌─────────────┬──────────────┬────────────┐
│ OpenRouter  │  Anthropic   │   Ollama   │
│ (default)   │ (production) │ (offline)  │
└─────────────┴──────────────┴────────────┘
      │
      ▼
AIResponse → display in VS Code + record in PricingService
```

---

## Layer Responsibilities

### Domain (`src/core/domain/`)
Pure TypeScript. Zero external dependencies. Contains:
- **`AIRequest` / `AIResponse`** — canonical request/response types used by all providers
- **Entities:** `TokenUsage`, `WorkspaceContext`, `OptimizedContext`, `FileContent`
- **Interfaces:** `IProvider` (canonical version now in `src/providers/base/`)

### Application (`src/core/application/`)
Use cases and port interfaces. Depends only on domain:
- **Ports:** `IContextPort`, `IOptimizerPort`
- **Use Cases:** `BuildContextUseCase`, `OptimizeTokensUseCase`

### Providers (`src/providers/`)
The entire AI provider stack. Contains:

```
providers/
├── base/
│   ├── IProvider.ts            ← ProviderName union + enhanced IProvider interface
│   ├── BaseProvider.ts         ← Abstract base (connect, countTokens, stream defaults)
│   └── ProviderCapabilities.ts ← ProviderCapabilities + ProviderHealth types
│
├── factory/
│   └── ProviderFactory.ts      ← Creates + wraps providers (only file with provider switch)
│
├── registry/
│   └── ProviderRegistry.ts     ← Reads config, delegates to factory, hot-switches
│
├── middleware/
│   ├── ProviderMiddleware.ts   ← Abstract pass-through base
│   ├── LoggingMiddleware.ts    ← Outermost: structured → / ✓ / ✗ logs
│   ├── RetryMiddleware.ts      ← Middle: exp. backoff (3x), non-retryable detection
│   └── MetricsMiddleware.ts    ← Innermost: fires ProviderEventBus events
│
├── models/
│   ├── anthropic.models.ts     ← Claude 3.5 Sonnet/Haiku, Opus, 3.7 Sonnet
│   ├── openrouter.models.ts    ← 5 free + 3 paid models
│   ├── ollama.models.ts        ← Qwen, Llama, DeepSeek, Mistral, Gemma, CodeLlama
│   ├── openai.models.ts        ← GPT-4o, GPT-4.1, o3/o4-mini (stub)
│   ├── gemini.models.ts        ← Gemini 2.5 Flash/Pro (stub)
│   ├── ModelCatalog.ts         ← Aggregator: query by ID / provider / capability
│   └── PricingCatalog.ts       ← $/M token pricing, separated from capabilities
│
├── openrouter/OpenRouterProvider.ts  ← native fetch, SSE streaming
├── anthropic/AnthropicProvider.ts   ← @anthropic-ai/sdk, real streaming
├── ollama/OllamaProvider.ts         ← OpenAI-compatible local API
├── openai/OpenAIProvider.ts         ← Stub (NOT_IMPLEMENTED)
└── gemini/GeminiProvider.ts         ← Stub (NOT_IMPLEMENTED)
```

### Features (`src/features/`)
Concrete implementations of core ports. Uses VS Code APIs:
- `workspace/` — WorkspaceReader, FileFilter, GitIntegration
- `context/` — ContextBuilder (serializes WorkspaceContext → prompt)
- `optimizer/` — TokenOptimizer (4-stage pipeline), BeforeAfterDiff
- `tokenMonitor/` — TokenMonitorPanel (webview), TokenCounter, CostEstimator
- `storage/` — SecretStorageService, SessionStatsService
- `statusBar/` — TokenStatusBar
- `settings/` — ISecretStore, VSCodeSecretStore, SettingsService

### Services (`src/services/`)
Cross-feature services without VS Code coupling:
- `pricing/PricingService` — session cost + saved-token accumulation
- `tokenizer/TokenCounter` — js-tiktoken + character fallback

### Shared (`src/shared/`)
Cross-cutting concerns:
- `constants/` — command IDs, exclusion patterns, token thresholds
- `errors/` — `TokenFlowError`, `TokenFlowErrorCode` (8 codes)
- `events/ProviderEventBus` — typed discriminated union; UI never imports providers
- `utils/logger` — VS Code OutputChannel singleton

---

## Dependency Direction

```
providers   →  services  →  shared
features    →  providers →  shared
features    →  services  →  shared
features    →  core      →  shared
(NEVER: domain → features, shared → features)
```

---

## Middleware Pipeline Order

```
LoggingMiddleware (outermost)
    ↓
RetryMiddleware
    ↓
MetricsMiddleware (innermost — closest to provider)
    ↓
Provider (OpenRouter | Anthropic | Ollama | ...)
```

LoggingMiddleware captures the full round-trip including retries.
MetricsMiddleware fires events *after* the final successful response.

---

## Key Design Decisions

See `.ai/ADR/` for rationale.

| Decision | v1.0 | v1.1 |
|---|---|---|
| Provider | Anthropic only | OpenRouter (default), Anthropic, Ollama |
| Default model | `claude-3-5-sonnet-20241022` | `google/gemma-3-12b-it:free` (free) |
| Provider construction | switch in Registry | ProviderFactory (only switch owner) |
| Model metadata | single ModelCatalog | split per-provider files |
| Capabilities | scattered booleans | `ProviderCapabilities` struct |
| Request/response types | provider-specific | `AIRequest` / `AIResponse` domain objects |
| Secret Storage | `SecretStorageService` directly | `ISecretStore` port → `VSCodeSecretStore` |
| Provider health | none | `ProviderHealth` from `connect()` |
| Pricing | in model catalog | `PricingCatalog` (separate) |
| Middleware | none | `Logging → Retry → Metrics` |
| UI/provider coupling | direct import | `ProviderEventBus` (events only) |
| Token counting | `features/tokenMonitor/` | `services/tokenizer/` |
| API key storage | VS Code SecretStorage | `ISecretStore` port (testable) |
| Git integration | VS Code Git Extension API (no shell-out) | unchanged |
| MCP in request path | NO | NO |

---

## Adding a New Provider (Checklist)

1. Create `src/providers/<name>/<Name>Provider.ts` extending `BaseProvider`
2. Create `src/providers/models/<name>.models.ts` with `ModelEntry[]`
3. Add pricing rows to `PricingCatalog.ts`
4. Add a `case '<name>':` in `ProviderFactory.createRaw()`
5. Extend `ProviderName` union in `IProvider.ts`
6. Add to `PROVIDER_DISPLAY` map in `SettingsService.ts`
7. Add tests to `src/providers/providers.test.ts`

**Zero changes** required in: domain, application, workspace, optimizer, context, statusBar, tokenMonitor.

---

## Measured Performance (v1.1)

| Metric | Value |
|---|---|
| Source files processed | 90 |
| Raw token count (full codebase) | 139,748 |
| Optimized token count | 41,344 |
| Tokens saved | 98,404 (**70%**) |
| Build time (esbuild) | ~170ms |
| Bundle size | 6.1MB (includes @anthropic-ai/sdk) |
| Test suite | 84 tests, ~1s |
| Type errors | 0 |
| Lint errors | 0 |

*Run `npm run dogfood` to reproduce token savings measurement.*
