# n8n Workflow Orchestration — TokenFlow AI

n8n acts as the MCP workflow orchestrator for TokenFlow AI. It handles automation tasks
that sit **outside** the extension's request path — CI triggers, documentation generation,
changelog updates, and test reporting.

## Setup

```bash
# Start the full MCP stack (n8n + postgres + all MCP servers)
docker compose -f docker-compose.mcp.yml up -d

# Open n8n UI
open http://localhost:5678
```

Default credentials (change immediately):
- Email: `admin@tokenflow.dev`
- Password: set via `N8N_BASIC_AUTH_PASSWORD` env var

## Workflows

Import workflow JSON files from `workflows/` into n8n via:
**Settings → Import from File**

| Workflow | File | Trigger |
|---|---|---|
| CI Status Reporter | `workflows/ci-reporter.json` | GitHub webhook on PR |
| Changelog Updater | `workflows/changelog-updater.json` | Push to main branch |
| Doc Generator | `workflows/doc-generator.json` | Feature branch merge |
| Test Coverage Report | `workflows/test-coverage.json` | CI completion webhook |

## MCP Integration

n8n is registered as an MCP server in `.ai/mcp-config.json`. Claude Code and Copilot
can trigger n8n workflows via MCP tool calls — for example:
- `n8n.trigger_workflow("changelog-updater")`
- `n8n.list_workflows()`

## Architecture Rule

n8n orchestrates **only automation tasks** — it never contains business logic.
All token optimization, context building, and provider communication stays in the extension.

## Environment Variables

```env
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your-n8n-api-key
N8N_BASIC_AUTH_USER=admin@tokenflow.dev
N8N_BASIC_AUTH_PASSWORD=change-me
GITHUB_TOKEN=your-github-pat
DATABASE_URL=postgresql://tokenflow:tokenflow@postgres:5432/tokenflow
```
