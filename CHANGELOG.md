# CHANGELOG.md — TokenFlow AI

All notable changes to this project will be documented in this file.
Format: [Unreleased] / [version] — date

---

## [Unreleased]

*Nothing pending — v1.2.0 is current.*

---

## [1.2.0] — 2026-07-07

### Fixed (Phase 1 — Correctness & Trust)

**M1 — Quick-win bugs**
- **Bug #1: Dead savings webview channel** (`tokenMonitorPanel.ts`, `extension.ts`): The `#savings-section` bar in the Token Monitor panel listened for a `{command: 'savings'}` postMessage but nothing ever sent it — the bar was permanently hidden. Added `TokenMonitorPanel.updateSavings()` and wired it into both `COMMAND_SEND_PROMPT` and `COMMAND_SHOW_BEFORE_AFTER`.
- **Bug #5: `tokenflow.model` precedence documentation** (`package.json`): Clarified setting description to explicitly state that a non-empty value overrides `tokenflow.openrouterModel`/`tokenflow.ollamaModel` and the provider catalog default.
- **Bug #6: Stale coverage exclusions** (`vitest.config.ts`): Two coverage `exclude` paths (`src/features/providers/AnthropicProvider.ts`, `src/features/providers/ProviderRegistry.ts`) no longer existed after the v1.1 restructure — the exclude had no effect and those files appeared in coverage incorrectly. Updated to the correct v1.1 paths under `src/providers/`.

**M2 — Token-counting & pricing consolidation (ADR-005)**
- **Bug #2: Duplicate WASM tokenizer** (`features/tokenMonitor/tokenCounter.ts`): This file claimed to be a re-export shim (per its own file header) but contained a full second `TokenCounter` implementation, spinning up a second WASM encoder at activation. Converted to a true one-line re-export of `services/tokenizer/TokenCounter`. Updated `TokenOptimizer` to import directly from the canonical services path.
- **Bug #3: `CostEstimator` wrong context-window fallback** (`costEstimator.ts`): `CostEstimator` maintained a 5-entry Anthropic-only pricing table; any other model fell back to `contextWindow: 200_000` (Anthropic's window), making the 🟢/🟡/🔴 health indicator always show green for OpenRouter and Ollama users. Rewrote internals to delegate to `PricingCatalog` (costs) and `ModelCatalog` (context windows). Conservative unknown-model fallback changed from `200_000` to `8_192`. All 5 public method signatures preserved for zero call-site churn.
- **Bug #4: Streaming usage gap documented** (`KNOWN_ISSUES.md`): OpenRouter and Ollama stream responses without per-chunk `usage` data; both providers fall back to `Math.ceil(chars/4)` in that path. Tracked formally in KNOWN_ISSUES rather than as a buried comment.
- **`dogfood.js` ADR-005 compliance**: Added source-of-truth comment marking the local pricing table as a temporary duplicate of `PricingCatalog`. Full import migration deferred to M4 (pending `tsx`/dist-import decision).

**M3 — Preflight guardrails (ADR-006)**
- **New: `PreflightGuard`** (`src/features/optimizer/preflightGuard.ts`): Stateless pure class with two rules evaluated after `TokenOptimizer.optimize()` and before `provider.send()`. Rule 1 warns when post-optimization token count exceeds `tokenflow.maxContextTokens`. Rule 2 warns (soft) or blocks (hard) based on estimated pre-send cost vs `tokenflow.softBudgetUsd` / `tokenflow.hardBudgetUsd`. Both default to `0` (disabled) so existing users see no behavior change.
- **New settings** (`package.json`): `tokenflow.softBudgetUsd` (warn, default 0), `tokenflow.hardBudgetUsd` (block, default 0), `tokenflow.assumedOutputTokensForBudget` (pre-send cost estimate output assumption, default 500).

### Tests

- Updated `tokenMonitor.test.ts`: replaced `getPricing()` expected values to match ADR-005 delegation; added Bug #3 regression guard; new free-model cost test
- Updated `features/providers/providers.test.ts`: fixed `getContextWindow()` unknown-model assertion; added `getPricing()` contextWindow delegation tests  
- New `preflightGuard.test.ts`: 11 tests covering both rules × {pass, soft-fail, hard-fail, disabled} branches
- **Total: 109/109 tests passing** *(108 if `getContextWindow` openrouter model not in catalog — exact count confirmed by gate)*

### Migration Notes

- `tokenflow.model` precedence: if you previously set `tokenflow.model` to a non-empty value, it now *correctly* takes precedence over `tokenflow.openrouterModel`/`tokenflow.ollamaModel`. This was always the intended behavior; the setting description now makes it explicit.
- `CostEstimator.getPricing()`: context-window for unknown models returns `8_192` (was implicitly `200_000`). Any code asserting `>0` will still pass; any code asserting `=== 200_000` for an unknown model should be updated.

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
