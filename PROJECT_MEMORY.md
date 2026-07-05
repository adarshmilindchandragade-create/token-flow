# PROJECT_MEMORY.md — TokenFlow AI

> Auto-generated when context health hits 🔴. Also updated manually at session handoff.
> Last updated: 2026-07-05

---

## Current Status

**Version:** v1.1.0 — multi-provider architecture complete and validated  
**Phase:** Production validation (F5 testing + dogfooding)  
**Tests:** 84/84 passing | 0 type errors | 0 lint errors  
**Next action:** F5 validation in Extension Development Host, then prepare marketplace publish

---

## What's Complete

### v0.1.0 Foundation
- [x] AI scaffolding: CLAUDE.md, copilot-instructions.md
- [x] MCP Gateway: .ai/mcp-config.json (infrastructure only)
- [x] ADRs: ADR-001 (provider), ADR-002 (no-MCP hot-path), ADR-003 (clean arch)
- [x] Project memory files: AI_INDEX.md, ARCHITECTURE.md, etc.
- [x] Extension manifest: package.json, tsconfig.json, .eslintrc.json, esbuild.config.js
- [x] WorkspaceReader, ContextBuilder, TokenOptimizer (4-stage pipeline)
- [x] TokenMonitorPanel (webview), TokenStatusBar
- [x] AnthropicProvider (v1), SecretStorageService, SessionStatsService
- [x] CI/CD: .github/workflows/ci.yml
- [x] 60 tests passing

### v1.1.0 Multi-Provider (current)
- [x] AIRequest / AIResponse domain objects
- [x] IProvider enhanced (ProviderName union, capabilities, connect, stream)
- [x] ProviderCapabilities + ProviderHealth types
- [x] ProviderEventBus (typed events — UI never imports providers)
- [x] ISecretStore port + VSCodeSecretStore + InMemorySecretStore
- [x] BaseProvider abstract base
- [x] OpenRouterProvider (free models, SSE streaming, native fetch)
- [x] AnthropicProvider (refactored onto BaseProvider, @anthropic-ai/sdk)
- [x] OllamaProvider (offline, OpenAI-compatible, no key)
- [x] OpenAIProvider (stub — NOT_IMPLEMENTED)
- [x] GeminiProvider (stub — NOT_IMPLEMENTED)
- [x] Model catalog split: anthropic/openrouter/ollama/openai/gemini .models.ts files
- [x] ModelCatalog aggregator (query by ID/provider/capability)
- [x] PricingCatalog (pricing separated from capabilities)
- [x] ProviderMiddleware abstract base
- [x] LoggingMiddleware (outermost — → / ✓ / ✗ logs)
- [x] RetryMiddleware (exp. backoff, 3 attempts, jitter, non-retryable detection)
- [x] MetricsMiddleware (innermost — fires ProviderEventBus events)
- [x] ProviderFactory (only class with provider switch logic)
- [x] ProviderRegistry (delegates to factory, hot-switches on config change)
- [x] SettingsService (provider/model quick-picks, per-provider key prompts)
- [x] PricingService (session cost accumulation, saved-token tracking)
- [x] TokenCounter moved to services/tokenizer/
- [x] ADR-004: OpenRouter-first strategy documented
- [x] New commands: tokenflow.selectProvider, tokenflow.selectModel
- [x] package.json: 5 providers, openrouter default, new config properties
- [x] extension.ts: wired all new services, hot-switch handler
- [x] shims at old import paths (backward compat)
- [x] 24 new tests (ModelCatalog, PricingCatalog, ProviderFactory, RetryMiddleware)
- [x] 10 new pricing tests
- [x] README rewritten (multi-provider, real dogfood numbers)
- [x] ARCHITECTURE.md updated to v1.1
- [x] CHANGELOG.md with full v1.1.0 release notes
- [x] scripts/dogfood.js (self-measurement: 139,748 → 41,344 tokens, **70% saved**)
- [x] F5_VALIDATION.md (10-scenario runbook)
- [x] HOW_TO_RUN.md (step-by-step F5 guide)

---

## Architecture Summary

See ARCHITECTURE.md for full details.

```
extension.ts
    │
    ├── ProviderEventBus ← StatusBar/Monitor subscribe (never import providers)
    ├── ProviderRegistry → ProviderFactory.create()
    │       └── LoggingMW → RetryMW → MetricsMW → Provider
    ├── SettingsService (provider/model quick-picks)
    ├── ContextBuilder → WorkspaceReader
    └── TokenOptimizer (4-stage, ~70% savings)
```

Provider priority: OpenRouter (default) → Anthropic (production) → Ollama (offline)

---

## Key Decisions

1. **OpenRouter default** — zero-cost development with free Gemma/Qwen/Llama models (ADR-004)
2. **ProviderFactory owns the switch** — ProviderRegistry has zero provider-specific logic
3. **Middleware pipeline** — Logging → Retry → Metrics separates concerns cleanly
4. **ProviderEventBus** — StatusBar/Monitor never import provider code
5. **ISecretStore port** — enables InMemorySecretStore in tests without mocking VS Code
6. **No MCP in request path** — direct API calls only; MCP = infrastructure tooling
7. **OpenAI/Gemini are stubs** — throw NOT_IMPLEMENTED; real implementations in v2
8. **Dogfooding** — TokenFlow used on itself; 70% token savings measured and committed

---

## Open Tasks (v2)

- [ ] OpenAI GPT-4o provider (real implementation)
- [ ] Gemini 2.5 Flash provider (real implementation)
- [ ] Tree-sitter AST context compression (ADR-003)
- [ ] Sidebar analytics dashboard
- [ ] MCP Gateway integration
- [ ] Rule-based model router
- [ ] Test coverage report (`npm run test:coverage`)
- [ ] VS Code Marketplace publish (`npm run package` → upload .vsix)

---

## Environment

- Node.js: 20.x
- TypeScript: 5.3.x
- VS Code API: ^1.85.0
- Test runner: Vitest 1.6.1
- Bundler: esbuild ~170ms, 6.1MB
- Runtime deps: @anthropic-ai/sdk ^0.32.0, js-tiktoken ^1.0.12
