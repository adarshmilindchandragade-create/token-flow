# CHANGELOG.md — TokenFlow AI

All notable changes to this project will be documented in this file.
Format: [Unreleased] / [version] — date

---

## [Unreleased]

*Nothing pending — v1.2.0 is current.*

---

## [1.2.0] — 2026-07-06

### Fixed

- **`TokenOptimizer` budget enforcement** (`src/features/optimizer/tokenOptimizer.ts`): `tokenflow.maxContextTokens` was read from config but never actually applied — the optimizer always forwarded the full context. Added `enforceTokenBudget()` as a final pipeline stage that drops `Imported File` sections first, then `Changed File` sections, then hard-truncates the remainder with a visible `⚠️ TokenFlow: additional content omitted` notice. Controlled by the existing `tokenflow.maxContextTokens` setting (default `100000`). 7 new unit tests added.
- **`AnthropicProvider.countTokens()`** (`src/providers/anthropic/AnthropicProvider.ts`): Overrides `BaseProvider`'s `chars/4` heuristic with the real `client.beta.messages.countTokens` Anthropic API endpoint. Falls back silently to the heuristic on any error so a counting failure never blocks the caller. Not yet wired to the UI token display (Phase 2 — tracked in `TODO.md`).

### Tests
- Added 7 `enforceTokenBudget()` tests to `src/features/optimizer/tokenOptimizer.test.ts`
- **Total: 91/91 tests passing**

---

## [1.1.0] — 2026-07-04

### 🎉 Multi-Provider Architecture (major)

TokenFlow AI is now provider-agnostic. The extension never hardcodes a provider — it routes through a `ProviderRegistry → ProviderFactory → middleware pipeline → concrete provider` chain. Switching providers requires zero code changes.

### Added

**Provider Layer**
- `OpenRouterProvider` — primary development provider, supports 50+ models including free tier (Gemma, Qwen, Llama, Mistral, DeepSeek, via `google/gemma-3-12b-it:free` default)
- `AnthropicProvider` — production provider via `@anthropic-ai/sdk` with full streaming
- `OllamaProvider` — offline local inference, no API key, OpenAI-compatible API
- `OpenAIProvider` — stub (throws `NOT_IMPLEMENTED`, placeholder for v2)
- `GeminiProvider` — stub (throws `NOT_IMPLEMENTED`, placeholder for v2)
- `BaseProvider` — abstract base with default `connect()`, `countTokens()`, streaming helpers
- `IProvider` — enhanced interface with `ProviderName` union, `capabilities`, `connect()`, `stream()`
- `ProviderCapabilities` — structured type for streaming/vision/thinking/tools/embeddings per model
- `ProviderHealth` — diagnostic type returned by `connect()`

**Factory & Registry**
- `ProviderFactory` — constructs providers and wraps in 3-layer middleware; zero switch logic in Registry
- `ProviderRegistry` — hot-switches providers on `onDidChangeConfiguration`; no VS Code restart needed
- `SettingsService` — provider quick-pick (🟢/🔴/🌐 readiness badges), model quick-pick, per-provider key prompts

**Middleware Pipeline** (outermost → innermost)
- `LoggingMiddleware` — structured `→` / `✓` / `✗` logs to VS Code output channel
- `RetryMiddleware` — 3 attempts, exponential backoff (1s base) + 200ms jitter; skips non-retryable errors
- `MetricsMiddleware` — fires typed `ProviderEventBus` events (started/chunk/completed/failed)

**Model Catalog (split per provider)**
- `anthropic.models.ts` — Claude 3.5 Sonnet/Haiku, Opus 4, 3.7 Sonnet (thinking)
- `openrouter.models.ts` — 5 free + 3 paid models
- `ollama.models.ts` — Qwen 2.5, Llama 3.1/3.3, DeepSeek R1, Mistral, Gemma, CodeLlama
- `openai.models.ts` — GPT-4o, GPT-4.1, o3-mini, o4-mini (stub)
- `gemini.models.ts` — Gemini 2.5 Flash, 2.5 Pro (stub)
- `ModelCatalog` — query by ID, provider, capability (thinking/vision/tools)
- `PricingCatalog` — pricing separated from capability metadata; `estimateCost()` helper

**Services**
- `PricingService` — session cost accumulation, saved-token tracking, lifetime stats, `reset()`
- `TokenCounter` — moved to `src/services/tokenizer/` with js-tiktoken + character fallback

**Events**
- `ProviderEventBus` — typed discriminated union events; UI never imports provider code

**Secret Store**
- `ISecretStore` — abstract port; `VSCodeSecretStore` (production) + `InMemorySecretStore` (tests)

**Error Codes**
- `TokenFlowErrorCode.NOT_IMPLEMENTED` — for provider stubs
- `TokenFlowErrorCode.MIDDLEWARE_ERROR` — for pipeline-level failures

**Commands (new)**
- `TokenFlow: Select Provider` (`tokenflow.selectProvider`) — provider quick-pick
- `TokenFlow: Select Model` (`tokenflow.selectModel`) — model quick-pick for active provider

**Configuration (new)**
- `tokenflow.provider` — now supports: `openrouter` | `anthropic` | `ollama` | `openai` | `gemini`
- `tokenflow.openrouterModel` — default: `google/gemma-3-12b-it:free`
- `tokenflow.ollamaModel` — default: `qwen2.5:latest`
- `tokenflow.ollamaBaseUrl` — default: `http://localhost:11434`
- Default provider changed from `anthropic` → `openrouter`

**Developer Tools**
- `scripts/dogfood.js` — self-measurement script; runs the optimizer pipeline on the TokenFlow source tree
- `npm run dogfood` — runs self-measurement (measured: 139,748 → 41,344 tokens, **70% saved**)
- `F5_VALIDATION.md` — 10-scenario manual validation runbook
- `ADR-004` — documents OpenRouter-first strategy

### Tests
- Added `src/providers/providers.test.ts` — 24 tests: ModelCatalog, PricingCatalog, ProviderFactory, RetryMiddleware
- Added `src/services/pricing/pricing.test.ts` — 10 tests: PricingService accumulation, reset, estimation
- **Total: 84/84 tests passing** (up from 60)

### Breaking Changes
- `tokenflow.provider` default changed from `"anthropic"` to `"openrouter"`
- `tokenflow.model` default changed from `"claude-3-5-sonnet-20241022"` to `""` (uses provider default)
- `ProviderRegistry` constructor now requires `ISecretStore` + `ProviderEventBus` (was `SecretStorageService` only)
- Imports from `src/features/providers/AnthropicProvider` and `src/features/providers/ProviderRegistry` still work via shims

---

## [0.1.0] — 2026-07-01

### Added
- AI scaffolding: `CLAUDE.md`, `.github/copilot-instructions.md`, `.ai/mcp-config.json`
- ADR-001 (provider abstraction), ADR-002 (no-MCP in request path), ADR-003 (clean arch)
- Project memory files: `AI_INDEX.md`, `ARCHITECTURE.md`, `API_REFERENCE.md`, `CHANGELOG.md`, `TODO.md`, `KNOWN_ISSUES.md`
- Extension skeleton: `package.json`, `tsconfig.json`, `.eslintrc.json`, `.prettierrc`, `esbuild.config.js`
- Clean Architecture layers: `core/domain`, `core/application`, `features/`, `shared/`
- `WorkspaceReader` — collects active file, git diff (via VS Code Git API), imports, README
- `TokenOptimizer` — 4-stage pipeline: comment strip, whitespace collapse, block truncation, deduplication
- `ContextBuilder` — serializes `WorkspaceContext` → prompt-ready markdown
- `TokenMonitorPanel` — webview showing real-time usage + cost
- `TokenStatusBar` — compact status bar with token/cost indicator
- `AnthropicProvider` — Anthropic-only v1 implementation
- `SecretStorageService` — VS Code SecretStorage wrapper
- `SessionStatsService` — persistent session stats
- `BeforeAfterDiff` — generates before/after comparison report
- Commands: Show Monitor, Set API Key, Send Prompt, Show Before/After, Reset Session
- CI/CD: `.github/workflows/ci.yml` (lint + type-check + test + build)
- **60 tests passing** across optimizer, tokenMonitor, workspace, contextBuilder, providers

---

## Format Notes

This file follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
