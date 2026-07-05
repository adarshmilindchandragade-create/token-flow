# GitHub Copilot Instructions — TokenFlow AI

## Project
Open-source VS Code extension. Token-aware AI context optimizer.
TypeScript + VS Code Extension API + Anthropic SDK.

## Architecture
Clean Architecture with feature-based modules:
- `src/core/domain/` — pure entities + interfaces (no VS Code deps)
- `src/core/application/` — use cases + ports
- `src/features/` — feature implementations (workspace, optimizer, providers, tokenMonitor, storage, statusBar)
- `src/shared/` — logger, errors, constants, types

## Rules
- Strict TypeScript: no `any`, no `!` without comment
- Single Responsibility: one concern per file
- Never shell out — use VS Code Git Extension API (`vscode.git`)
- API keys → VS Code `SecretStorage` only (never config files, never logs)
- All webviews must have a Content-Security-Policy nonce
- Dispose all `vscode.Disposable`s in `context.subscriptions`
- Feature completion: implement → test → lint → type-check → commit

## v1 Provider
Anthropic only. OpenAI and Ollama are TODO stubs in ProviderRegistry.

## Test framework
Vitest. Unit tests in `src/features/<feature>/<feature>.test.ts`.

## Do not build (v1 scope)
- Model router (deferred to v2)
- Sidebar (deferred to v2)
- OpenAI/Ollama implementations (stubs only)
- MCP in request path (docker-compose.mcp.yml is infrastructure only)
- AST/Tree-sitter compression (v2)
