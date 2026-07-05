# ADR-002: No MCP in the v1 Request Path

**Status:** Accepted  
**Date:** 2026-07-01  
**Author:** TokenFlow AI Team  

---

## Context

The original platform vision included an MCP server as a hard dependency from day one.
MVP_PLAN.md explicitly defers this, noting: *"the extension can call provider APIs directly.
Introduce the MCP server only when there's an actual second consumer."*

## Decision

For v1, the VS Code extension calls the Anthropic API **directly** (no MCP intermediary).

MCP infrastructure (`docker-compose.mcp.yml`, `.ai/mcp-config.json`) is scaffolded and
committed so it can be activated with a single `docker compose up`, but zero extension code
depends on it.

## Rationale

- MCP in the hot path adds a network hop with no benefit when there is only one consumer.
- Validating the core token-savings claim does not require MCP.
- The MCP scaffold is available for AI agent tooling (Claude Code, Copilot) without blocking
  the extension's request path.

## Consequences

- v1 extension: `extension → AnthropicProvider → Anthropic API`
- v2+ (when CLI tool or web app exists): `CLI/extension → MCP Gateway → providers`
- n8n is used for workflow automation (CI, doc generation) — not business logic.
