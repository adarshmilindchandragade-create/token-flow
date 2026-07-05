# ADR-004 — OpenRouter-First Multi-Provider Strategy

**Date:** 2026-07-02  
**Status:** Accepted  
**Authors:** TokenFlow AI Core Team  
**Supercedes:** ADR-001 (provider choice: Anthropic)

---

## Context

ADR-001 selected Anthropic as the sole provider for v1 under the rationale of "one deep integration beats two shallow ones."

v1.1 graduates the provider layer into a full multi-provider architecture. The motivation:

1. **Development cost** — Anthropic credits are consumed during development. OpenRouter offers genuinely free models (Gemma, Qwen, Llama variants) at zero cost.
2. **Offline development** — Ollama enables completely offline coding sessions with no API cost.
3. **Provider resilience** — Depending on a single commercial API creates a single point of failure.
4. **User choice** — Different users have different constraints (data residency, cost, model preference).
5. **Capability breadth** — OpenRouter exposes 50+ models through one endpoint and one API key.

---

## Decision

### Primary development provider: OpenRouter

- **Default**: `tokenflow.provider = "openrouter"`, `tokenflow.openrouterModel = "google/gemma-3-12b-it:free"`
- **Why**: Free tier available, single API key gives access to Claude, GPT, Gemma, Qwen, DeepSeek, Llama, Mistral
- **Key**: Free at [openrouter.ai](https://openrouter.ai) — email signup, no credit card

### Secondary (offline): Ollama

- **Default model**: `qwen2.5:latest`
- **Why**: Zero cost, zero network, works without any API key
- **Requirement**: Ollama installed locally (`brew install ollama` / winget)

### Production: Anthropic

- **Default model**: `claude-3-5-sonnet-20241022`
- **Why**: Highest quality Claude experience, direct API, lowest latency for paid users

### Future: OpenAI, Gemini

- Stubs present in codebase, `NOT_IMPLEMENTED` error thrown until wired
- Added as v2 items in TODO.md

---

## Provider Priority (for future auto-fallback)

```
OpenRouter  →  Anthropic  →  OpenAI  →  Gemini  →  Ollama
```

Rationale for order:
1. OpenRouter: broadest model access, free tier, single key
2. Anthropic: highest quality, direct API
3. OpenAI: strong ecosystem, widely used
4. Gemini: strong multimodal, Google infrastructure
5. Ollama: offline-only, no internet required — last resort

---

## Architecture Decisions

### ProviderFactory (no switch in Registry)

`ProviderRegistry` delegates provider construction to `ProviderFactory.create()`. This removes the switch statement from the registry and allows new providers to be added by modifying only `ProviderFactory`.

### Middleware Pipeline

All providers are wrapped in a three-layer middleware pipeline before being returned from the factory:

```
LoggingMiddleware → RetryMiddleware → MetricsMiddleware → Provider
```

- **MetricsMiddleware**: emits typed events to `ProviderEventBus`
- **RetryMiddleware**: exponential backoff (3 attempts, 1s initial delay)
- **LoggingMiddleware**: traces request start/end to output channel

Providers themselves only make API calls. Cross-cutting concerns live in middleware.

### ISecretStore port

The provider layer accepts `ISecretStore` (interface), not `vscode.SecretStorage` (VS Code API). This allows:
- Tests to inject `InMemorySecretStore`
- Future CLI version to inject a file-based store
- Web dashboard to inject a remote KMS store

### Split ModelCatalog

Per-provider model files (`anthropic.models.ts`, `openrouter.models.ts`, etc.) are aggregated by `ModelCatalog.ts`. Pricing is separated into `PricingCatalog.ts` — model metadata stays stable while prices change frequently.

### ProviderEventBus

Status bar and token monitor do NOT import any provider code. They subscribe to `ProviderEventBus` events. This decouples UI from the provider pipeline entirely.

---

## Consequences

### Positive
- Development proceeds with zero Anthropic cost (free models via OpenRouter or Ollama)
- Adding a new provider requires only: a new provider class + a new case in ProviderFactory
- Status bar and token monitor are fully decoupled from provider internals
- Health checks are standardized via `ProviderHealth` type
- Capabilities are queryable without calling the provider

### Negative
- Users setting up fresh must get an OpenRouter key (free but adds friction)
- Existing users with `tokenflow.provider = "anthropic"` continue working unchanged — no breakage

### Neutral
- `@anthropic-ai/sdk` remains a dependency for the Anthropic provider
- No new runtime SDK dependencies — OpenRouter, Ollama, and OpenAI stubs use native `fetch`

---

## Related ADRs

- ADR-001: Superseded (provider choice: Anthropic only → now multi-provider)
- ADR-002: Unchanged (no MCP in extension hot path)
- ADR-003: Unchanged (Clean Architecture)
