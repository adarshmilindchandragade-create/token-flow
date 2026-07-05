# DATABASE_SCHEMA.md — TokenFlow AI

> **Note:** TokenFlow AI v1 has no database. All state is stored in:
> - VS Code SecretStorage — API keys
> - VS Code globalStorageUri — session stats (local JSON)
>
> A PostgreSQL schema is included below for the **MCP infrastructure stack** (n8n + future v2 analytics).
> The extension itself never connects to this database in v1.

---

## v1 — Local Storage Only

### SecretStorage (VS Code built-in)
```
Key: tokenflow.apiKey.anthropic → string (API key, encrypted by VS Code)
```

### Session Stats (JSON file at globalStorageUri/session-stats.json)
```json
{
  "totalInputTokens": 0,
  "totalOutputTokens": 0,
  "totalCostUsd": 0.0,
  "requestCount": 0,
  "startedAt": "2026-07-01T00:00:00Z"
}
```

---

## v2+ — PostgreSQL Schema (MCP stack, optional)

```sql
-- Usage history for cost analytics and trend tracking
CREATE TABLE IF NOT EXISTS usage_events (
  id            BIGSERIAL PRIMARY KEY,
  session_id    UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider      TEXT NOT NULL,
  model         TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd      NUMERIC(10, 6) NOT NULL,
  task_type     TEXT,          -- 'bug' | 'feature' | 'refactor' | 'explain'
  workspace_id  TEXT           -- anonymized workspace hash
);

CREATE INDEX ON usage_events (session_id);
CREATE INDEX ON usage_events (created_at);
CREATE INDEX ON usage_events (provider, model);

-- Optimization results for validating token savings claims
CREATE TABLE IF NOT EXISTS optimization_events (
  id                   BIGSERIAL PRIMARY KEY,
  usage_event_id       BIGINT REFERENCES usage_events(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_token_count      INTEGER NOT NULL,
  optimized_token_count INTEGER NOT NULL,
  saved_tokens         INTEGER NOT NULL,
  savings_percent      SMALLINT NOT NULL
);
```
