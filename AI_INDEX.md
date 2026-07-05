# AI_INDEX.md — TokenFlow AI Repository Map

> **For AI agents:** Consult this file instead of re-reading the whole repo for orientation.
> Updated at end of each completed Medium/Huge feature.
> Last updated: 2026-07-05 | Version: v1.1.0

---

## Project Summary

VS Code extension that reads workspace context, trims it intelligently (typically **70% fewer tokens**) before sending to any AI model, and shows real before/after savings. Supports OpenRouter, Anthropic, Ollama — hot-switchable without restart.

**Status:** v1.1.0 complete — 84/84 tests | 0 errors | ready for F5 validation  
**Repository:** `project 6 token flow`  
**License:** MIT

---

## Project Structure

```
.ai/
  ADR/                       Architecture Decision Records (001–004)
  mcp-config.json            MCP infrastructure config (not in request path)
  n8n/                       n8n workflow stubs
.github/
  copilot-instructions.md    Copilot agent rules
  workflows/
    ci.yml                   CI: lint + type-check + test + build
    publish.yml              CD: vsce publish (manual trigger)
media/
  tokenMonitor/              Webview assets (HTML, JS, CSS)
scripts/
  dogfood.js                 Self-measurement: runs optimizer on own codebase
src/
  core/
    domain/
      AIRequest.ts           ← Canonical AIRequest / AIResponse / StreamChunkHandler
      entities/              TokenUsage.ts, WorkspaceContext.ts, OptimizedContext.ts
      interfaces/            IProvider.ts (shim → providers/base/)
    application/
      useCases/              BuildContextUseCase.ts, OptimizeTokensUseCase.ts
      ports/                 IContextPort.ts, IOptimizerPort.ts
  providers/                 ← NEW in v1.1 — entire AI provider stack
    base/
      IProvider.ts           ProviderName union + IProvider interface
      BaseProvider.ts        Abstract base (connect, countTokens, stream defaults)
      ProviderCapabilities.ts ProviderCapabilities + ProviderHealth
    factory/
      ProviderFactory.ts     Creates providers + wraps middleware (ONLY switch owner)
    registry/
      ProviderRegistry.ts    Hot-switches on config change; delegates to factory
    middleware/
      ProviderMiddleware.ts  Abstract pass-through base
      LoggingMiddleware.ts   → / ✓ / ✗ logs to output channel
      RetryMiddleware.ts     Exponential backoff (3x, 1s base, 200ms jitter)
      MetricsMiddleware.ts   Fires ProviderEventBus events
    models/
      ModelCatalog.ts        Query models by ID / provider / capability
      PricingCatalog.ts      $/M token pricing (separate from capabilities)
      anthropic.models.ts    Claude 3.5 Sonnet/Haiku, Opus, 3.7 Sonnet (thinking)
      openrouter.models.ts   5 free + 3 paid OpenRouter models
      ollama.models.ts       Qwen, Llama, DeepSeek, Mistral, Gemma, CodeLlama
      openai.models.ts       GPT-4o, o3/o4-mini (stubs)
      gemini.models.ts       Gemini 2.5 Flash/Pro (stubs)
    openrouter/
      OpenRouterProvider.ts  native fetch + SSE streaming; default dev provider
    anthropic/
      AnthropicProvider.ts   @anthropic-ai/sdk; production provider
    ollama/
      OllamaProvider.ts      OpenAI-compat local API; no key; offline
    openai/
      OpenAIProvider.ts      Stub — throws NOT_IMPLEMENTED
    gemini/
      GeminiProvider.ts      Stub — throws NOT_IMPLEMENTED
    providers.test.ts        24 tests (ModelCatalog, Pricing, Factory, Retry)
  features/
    workspace/               WorkspaceReader, FileFilter, GitIntegration
    context/                 ContextBuilder (serialize WorkspaceContext → prompt)
    optimizer/               TokenOptimizer (4-stage), BeforeAfterDiff
    tokenMonitor/            TokenMonitorPanel (webview), TokenCounter, CostEstimator
    providers/               AnthropicProvider.ts, ProviderRegistry.ts (shims only)
    storage/                 SecretStorageService, SessionStatsService
    statusBar/               TokenStatusBar
    settings/
      ISecretStore.ts        Port + InMemorySecretStore (for tests)
      VSCodeSecretStore.ts   Production implementation
      SettingsService.ts     Provider/model quick-picks + key prompts
  services/
    pricing/
      PricingService.ts      Session cost accumulation + saved-token tracking
      pricing.test.ts        10 tests
    tokenizer/
      TokenCounter.ts        js-tiktoken cl100k_base + character fallback
  shared/
    constants/               Command IDs, thresholds, excluded patterns
    errors/                  TokenFlowError, TokenFlowErrorCode (8 codes)
    events/
      ProviderEventBus.ts    Typed events (started/chunk/completed/failed)
    utils/
      logger.ts              VS Code OutputChannel singleton
  extension.ts               v1.1 entry point — wires all services + 7 commands
CLAUDE.md                    Agent operating rules
AI_INDEX.md                  This file
ARCHITECTURE.md              Full system design (v1.1)
CHANGELOG.md                 v0.1.0 + v1.1.0 release notes
HOW_TO_RUN.md                Step-by-step F5 guide for VS Code
F5_VALIDATION.md             10-scenario manual validation runbook
PROJECT_MEMORY.md            Session handoff snapshot
TODO.md                      Open v2 tasks
KNOWN_ISSUES.md              Known limitations
docker-compose.mcp.yml       MCP infrastructure stack
package.json                 Extension manifest (v1.1.0)
tsconfig.json                TypeScript strict config
esbuild.config.js            Bundle → dist/extension.js (6.1MB, 170ms)
```

---

## VS Code Commands

| Command ID | Title | Status |
|---|---|---|
| `tokenflow.showTokenMonitor` | Show Token Monitor | ✅ |
| `tokenflow.setApiKey` | Set API Key (per-provider) | ✅ |
| `tokenflow.selectProvider` | Select Provider (quick-pick) | ✅ NEW |
| `tokenflow.selectModel` | Select Model (quick-pick) | ✅ NEW |
| `tokenflow.sendPrompt` | Send Optimized Prompt | ✅ |
| `tokenflow.showBeforeAfter` | Show Before/After Comparison | ✅ |
| `tokenflow.resetSession` | Reset Session Stats | ✅ |

---

## Configuration Keys

| Key | Default | Description |
|---|---|---|
| `tokenflow.provider` | `openrouter` | Active provider |
| `tokenflow.model` | `""` | Override model (empty = provider default) |
| `tokenflow.openrouterModel` | `google/gemma-3-12b-it:free` | OpenRouter default |
| `tokenflow.ollamaModel` | `qwen2.5:latest` | Ollama default |
| `tokenflow.ollamaBaseUrl` | `http://localhost:11434` | Ollama endpoint |
| `tokenflow.maxContextTokens` | `100000` | Hard cap |
| `tokenflow.includeReadme` | `true` | Include README in context |
| `tokenflow.stripComments` | `false` | Strip comments (reduces quality) |

---

## Completed Features

- [x] AI scaffolding (CLAUDE.md, .ai/*, ADRs, n8n README)
- [x] Extension skeleton + build tooling
- [x] WorkspaceReader (active file, git diff, imports, README)
- [x] TokenOptimizer (4-stage: whitespace, truncation, dedup, comment strip)
- [x] ContextBuilder (serializes WorkspaceContext → prompt markdown)
- [x] TokenMonitorPanel (webview), TokenStatusBar
- [x] Secret storage, session stats
- [x] CI/CD pipelines
- [x] **Multi-provider architecture (v1.1)** — OpenRouter, Anthropic, Ollama
- [x] **Middleware pipeline** — Logging, Retry, Metrics
- [x] **ModelCatalog + PricingCatalog** (split per provider)
- [x] **ProviderEventBus** — decoupled UI
- [x] **SettingsService** — hot-switch quick-picks
- [x] **Dogfooding** — 70% token savings measured on own codebase
- [x] README with real benchmark numbers
- [x] HOW_TO_RUN.md + F5_VALIDATION.md

---

## Key Decisions

See `.ai/ADR/` for full ADR documents.

1. **OpenRouter default** — free models enable zero-cost development (ADR-004)
2. **ProviderFactory** owns the only provider switch — Registry has no provider logic
3. **Middleware pipeline** — Logging → Retry → Metrics (all cross-cutting concerns)
4. **ProviderEventBus** — StatusBar/Monitor never import provider code
5. **ISecretStore port** — testable without VS Code mocking
6. **No MCP in request path** — direct API calls; MCP = infrastructure only
7. **OpenAI/Gemini stubs** — throw NOT_IMPLEMENTED cleanly

---

## Dependencies

**Runtime:**
- `@anthropic-ai/sdk` ^0.32.0 — Anthropic streaming API
- `js-tiktoken` ^1.0.12 — Token counting (cl100k_base)

**Dev:**
- `typescript` ^5.3.0
- `esbuild` ^0.20.0 — Bundler (170ms, 6.1MB)
- `vitest` ^1.2.0 — Test runner (84 tests, ~1s)
- `@vscode/vsce` ^2.24.0 — Extension packager
- `eslint`, `prettier` — Linting/formatting

---

## Test Coverage

| File | Tests | Coverage area |
|---|---|---|
| `optimizer/tokenOptimizer.test.ts` | 10 | 4-stage pipeline |
| `services/pricing/pricing.test.ts` | 10 | PricingService |
| `tokenMonitor/tokenMonitor.test.ts` | 12 | Cost estimation, panel |
| `features/providers/providers.test.ts` | 4 | Legacy provider |
| `workspace/workspaceReader.test.ts` | 16 | File collection |
| `context/contextBuilder.test.ts` | 8 | Serialization |
| `providers/providers.test.ts` | 24 | ModelCatalog, Factory, Retry |
| **Total** | **84** | **all core paths** |

---

## Coding Standards

- Strict TypeScript (`exactOptionalPropertyTypes: true`, no `any` without comment)
- Feature-based modules: `src/features/<name>/<name>.ts`
- Tests alongside source: `<name>.test.ts`
- Dependency direction: features → providers → services → core → shared (never reverse)
- 300-line file smell detector
- No `shell-out` for git (VS Code Git Extension API only)
