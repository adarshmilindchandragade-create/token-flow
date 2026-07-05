# TODO.md — TokenFlow AI

Updated at end of each completed feature. See AI_INDEX.md for current status overview.

---

## v1 — Current Sprint

### Step 2: Extension Skeleton
- [x] package.json
- [x] tsconfig.json
- [x] .eslintrc.json / .prettierrc
- [x] esbuild.config.js
- [ ] src/extension.ts (entry point)
- [ ] src/shared/types/index.ts
- [ ] src/shared/constants/index.ts
- [ ] src/shared/utils/logger.ts
- [ ] src/shared/errors/TokenFlowError.ts

### Step 3: Core Domain Layer
- [ ] src/core/domain/entities/TokenUsage.ts
- [ ] src/core/domain/entities/WorkspaceContext.ts
- [ ] src/core/domain/interfaces/IProvider.ts
- [ ] src/core/application/ports/IContextPort.ts
- [ ] src/core/application/useCases/BuildContextUseCase.ts
- [ ] src/core/application/useCases/OptimizeTokensUseCase.ts

### Step 4: Workspace Reader
- [ ] src/features/workspace/gitIntegration.ts
- [ ] src/features/workspace/fileFilter.ts
- [ ] src/features/workspace/workspaceReader.ts
- [ ] src/features/workspace/workspaceReader.test.ts

### Step 5: Context Builder
- [ ] src/features/context/importScanner.ts
- [ ] src/features/context/contextBuilder.ts
- [ ] src/features/context/contextBuilder.test.ts

### Step 6: Token Optimizer (simplified v1)
- [ ] src/features/optimizer/tokenOptimizer.ts (diff filter, import scan, comment/log trim)
- [ ] src/features/optimizer/beforeAfterDiff.ts
- [ ] src/features/optimizer/tokenOptimizer.test.ts

### Step 7: Token Monitor
- [ ] src/features/tokenMonitor/tokenCounter.ts
- [ ] src/features/tokenMonitor/costEstimator.ts
- [ ] src/features/tokenMonitor/tokenMonitorPanel.ts
- [ ] src/features/tokenMonitor/tokenMonitor.test.ts
- [ ] media/tokenMonitor/main.js
- [ ] media/tokenMonitor/style.css

### Step 8: Anthropic Provider + Storage
- [ ] src/features/providers/AnthropicProvider.ts
- [ ] src/features/providers/ProviderRegistry.ts
- [ ] src/features/providers/providers.test.ts
- [ ] src/features/storage/secretStorage.ts
- [ ] src/features/storage/sessionStats.ts

### Step 9: Status Bar
- [ ] src/features/statusBar/tokenStatusBar.ts

### Step 10: CI/CD
- [ ] .github/workflows/ci.yml
- [ ] .github/workflows/publish.yml

### Step 11: MCP Infrastructure
- [ ] docker-compose.mcp.yml
- [ ] .ai/n8n/workflows/ (stub workflow JSONs)

### Step 12: Polish + Publish
- [ ] Wire sendPrompt command end-to-end
- [ ] Wire showBeforeAfter command
- [ ] Dogfood on real repo for 1 week
- [ ] Write real token savings numbers into README
- [ ] Record demo GIF
- [ ] Publish to VS Code Marketplace

---

## v2 Backlog

- [ ] OpenAI provider connector
- [ ] Ollama provider connector
- [ ] Rule-based model router (diff size, keywords, file count)
- [ ] Sidebar UI (React + webview)
- [ ] AST/Tree-sitter context compression
- [ ] MCP Gateway integration in request path
- [ ] Prompt/response caching for repeated context
- [ ] Terminal output summarization

## v3 Backlog

- [ ] Multi-IDE support (Cursor, Windsurf)
- [ ] Visual dashboard with cost forecasting
- [ ] Session history with local SQLite
- [ ] Team-shared optimization rules
