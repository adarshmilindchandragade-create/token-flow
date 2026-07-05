# ADR-001: Anthropic as Sole v1 Provider

**Status:** Accepted  
**Date:** 2026-07-01  
**Author:** TokenFlow AI Team  

---

## Context

The extension needs at least one real AI provider to validate the core claim:
*context trimming reduces tokens without degrading answer quality*.

Multiple shallow integrations are worse than one that actually works end-to-end.

## Decision

Use **Anthropic (Claude)** as the only wired provider for v1.

The `IProvider` interface is defined in `src/core/domain/interfaces/IProvider.ts` so adding
a second provider is additive (not a rewrite). `ProviderRegistry` has TODO stubs for OpenAI
and Ollama.

## Rationale

- Anthropic's API is well-documented and returns `usage.input_tokens` / `usage.output_tokens`
  natively — no custom counting needed.
- Claude Sonnet offers strong performance at a price point that makes token savings meaningful
  and visible.
- One integration done well beats two done shallowly.

## Consequences

- OpenAI and Ollama are deferred to v2.
- The provider interface is deliberately thin — any second provider must only implement `IProvider`.
- Pricing table in `CostEstimator` is hardcoded for v1; fetched from provider API in v2.
