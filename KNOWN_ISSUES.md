# KNOWN_ISSUES.md — TokenFlow AI

Open bugs and known limitations. Updated incrementally.

---

## Open

*(none — all known issues are closed or by-design)*

---

## By Design (not bugs)

| Limitation | Reason | Fix version |
|---|---|---|
| Only Anthropic provider supported | v1 scope — one deep integration beats two shallow ones | v2 |
| No model router | Routing only makes sense with multiple active providers | v2 |
| No sidebar UI | Status bar + monitor panel sufficient for v1 validation | v2 |
| Token counting uses cl100k_base for all non-Anthropic models | Anthropic uses a different tokenizer; `AnthropicProvider.countTokens()` now calls the real endpoint (v1.2). Other providers still use estimates. | v2 |
| Import scanner is depth-1 only | Full dependency graph is expensive to build for v1 | v2 |
| Pricing table is hardcoded | Avoids fragile API fetching; goes stale when Anthropic changes prices | v2 |
| No MCP in extension request path | Unnecessary indirection until a second consumer exists | v2 |

---

## Closed

| Issue | Fix | Version |
|---|---|---|
| `tokenflow.maxContextTokens` config was read but never enforced — optimizer always sent the full context regardless of the setting | `enforceTokenBudget()` stage added as final step in `TokenOptimizer.optimize()`; drops low-priority sections tier-by-tier then hard-truncates with a visible notice | v1.2 |
| `AnthropicProvider` used the inherited `chars/4` heuristic for `countTokens()` instead of the real Anthropic API | `countTokens()` now overrides `BaseProvider` and calls `client.beta.messages.countTokens`; falls back to heuristic on any failure | v1.2 |
