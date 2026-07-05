# API_REFERENCE.md — TokenFlow AI

Last updated: 2026-07-01

---

## VS Code Commands

| Command ID | Title | Implementation File |
|---|---|---|
| `tokenflow.showTokenMonitor` | Show Token Monitor | `src/features/tokenMonitor/tokenMonitorPanel.ts` |
| `tokenflow.setApiKey` | Set API Key | `src/features/storage/secretStorage.ts` |
| `tokenflow.sendPrompt` | Send Optimized Prompt | `src/extension.ts` (wires context + optimizer + provider) |
| `tokenflow.showBeforeAfter` | Show Before/After Comparison | `src/features/optimizer/beforeAfterDiff.ts` |
| `tokenflow.resetSession` | Reset Session Stats | `src/features/storage/sessionStats.ts` |

---

## IProvider Interface

```typescript
// src/core/domain/interfaces/IProvider.ts
interface IProvider {
  readonly name: string;
  readonly modelId: string;
  readonly contextWindowSize: number;
  readonly inputCostPerMToken: number;   // USD per 1M input tokens
  readonly outputCostPerMToken: number;  // USD per 1M output tokens
  send(request: ProviderRequest): Promise<ProviderResponse>;
  isAvailable(): Promise<boolean>;
}

interface ProviderRequest {
  systemPrompt?: string;
  messages: ProviderMessage[];
  maxTokens?: number;
  model?: string;
}

interface ProviderMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ProviderResponse {
  content: string;
  usage: TokenUsage;
  model: string;
  stopReason: string | null;
}
```

---

## IContextPort Interface

```typescript
// src/core/application/ports/IContextPort.ts
interface IContextPort {
  buildContext(): Promise<WorkspaceContext>;
}

interface IOptimizerPort {
  optimize(context: WorkspaceContext): Promise<OptimizedContext>;
}
```

---

## VS Code Configuration

| Setting | Type | Default | Description |
|---|---|---|---|
| `tokenflow.provider` | string | `"anthropic"` | AI provider (v1: anthropic only) |
| `tokenflow.model` | string | `"claude-3-5-sonnet-20241022"` | Model identifier |
| `tokenflow.maxContextTokens` | number | `100000` | Hard cap on tokens sent |
| `tokenflow.includeReadme` | boolean | `true` | Include README.md in context |
| `tokenflow.stripComments` | boolean | `false` | Strip code comments |

---

## Webview Messages (TokenMonitorPanel)

| Direction | Command | Payload |
|---|---|---|
| Extension → Webview | `update` | `{ stats: SessionTokenUsage }` |
| Webview → Extension | `refresh` | `{}` |
