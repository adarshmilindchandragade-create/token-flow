# KNOWN_ISSUES.md — TokenFlow AI

Open bugs and known limitations. Updated incrementally.

---

## Open

*(none yet — project in initial scaffolding phase)*

---

## By Design (not bugs)

| Limitation | Reason | Fix version |
|---|---|---|
| Only Anthropic provider supported | v1 scope — one deep integration beats two shallow ones | v2 |
| No model router | Routing only makes sense with multiple active providers | v2 |
| No sidebar UI | Status bar + monitor panel sufficient for v1 validation | v2 |
| Token counting uses cl100k_base for all models | Anthropic uses a different tokenizer internally; counts are estimates | v2 (provider-specific counters) |
| Import scanner is depth-1 only | Full dependency graph is expensive to build for v1 | v2 |
| Pricing table is hardcoded | Avoids fragile API fetching; goes stale when Anthropic changes prices | v2 |
| No MCP in extension request path | Unnecessary indirection until a second consumer exists | v2 |

---

## Closed

*(none yet)*
