# TokenFlow AI

> **Provider-agnostic AI context optimizer for VS Code.**  
> Sit between your editor and any LLM. Trim what gets sent. Track what it costs.

[![CI](https://github.com/tokenflow-ai/tokenflow-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/tokenflow-ai/tokenflow-ai/actions)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/tokenflow-ai.tokenflow-ai)](https://marketplace.visualstudio.com/items?itemName=tokenflow-ai.tokenflow-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-84%20passing-brightgreen)](https://github.com/tokenflow-ai/tokenflow-ai/actions)

---

## What it does

TokenFlow AI intercepts every prompt before it reaches the model. It reads your workspace, decides what's actually relevant, compresses the signal, and gives you a live view of tokens and cost.

```
Your workspace
      │
      ▼
Context Builder
  → Active file
  → Git diff
  → Imports
  → README
      │
      ▼
Optimizer
  → Whitespace collapse
  → Long block truncation
  → Deduplication
  → (optional) Comment strip
      │
  Before: 12,400 tokens  →  After: 4,980 tokens  →  Saved: 7,420 (60%)
      │
      ▼
ProviderRegistry
  → OpenRouter (free models, default)
  → Anthropic (production)
  → Ollama (offline, no key)
  → OpenAI / Gemini (v2)
```

---

## Features (v1.1)

| Feature | Status |
|---|---|
| Multi-provider support (OpenRouter, Anthropic, Ollama) | ✅ |
| Free-model default (google/gemma-3-12b-it:free) | ✅ |
| Hot-switch providers without restart | ✅ |
| Live token monitor panel (usage + cost + savings) | ✅ |
| Git diff-based context collection | ✅ |
| Import scanning (active file dependencies) | ✅ |
| README inclusion in context | ✅ |
| Whitespace collapse + block truncation | ✅ |
| Before/after comparison view | ✅ |
| Streaming responses | ✅ |
| API keys via VS Code Secret Storage (per provider) | ✅ |
| Session cost tracking + reset | ✅ |
| Provider health diagnostics | ✅ |
| Retry middleware (3 attempts, exponential backoff) | ✅ |
| OpenAI / Gemini provider | ⏳ v2 |
| Tree-sitter AST compression | ⏳ v2 |
| Sidebar analytics dashboard | ⏳ v2 |
| MCP Gateway integration | ⏳ v2 |

---

## Quick Start

### Option 1 — OpenRouter (recommended, free tier available)

1. Sign up at [openrouter.ai](https://openrouter.ai) — no credit card required for free models
2. `Ctrl+Shift+P` → **TokenFlow: Select Provider** → choose **OpenRouter**
3. `Ctrl+Shift+P` → **TokenFlow: Set API Key** → paste your `sk-or-...` key
4. Default model: **Gemma 3 12B** (`google/gemma-3-12b-it:free`) — **$0.00/request**

### Option 2 — Ollama (offline, no API key)

```bash
# Install Ollama
winget install Ollama.Ollama          # Windows
brew install ollama                    # macOS

# Pull a model
ollama pull qwen2.5

# In VS Code settings
"tokenflow.provider": "ollama"
```

No key. No internet. Works immediately.

### Option 3 — Anthropic (production quality)

1. Get a key at [console.anthropic.com](https://console.anthropic.com)
2. `Ctrl+Shift+P` → **TokenFlow: Select Provider** → choose **Anthropic**
3. `Ctrl+Shift+P` → **TokenFlow: Set API Key** → paste your `sk-ant-...` key
4. Default model: **Claude 3.5 Sonnet** (`claude-3-5-sonnet-20241022`)

---

## Installation

### From VS Code Marketplace
Search **"TokenFlow AI"** in the Extensions panel (`Ctrl+Shift+X`).

### From source
```bash
git clone https://github.com/tokenflow-ai/tokenflow-ai
cd tokenflow-ai
npm install
npm run build
# Press F5 in VS Code → Extension Development Host launches
```

---

## Commands

| Command | Description |
|---|---|
| `TokenFlow: Select Provider` | Quick-pick across all providers with readiness status |
| `TokenFlow: Select Model` | Pick a model for the active provider (free models first) |
| `TokenFlow: Set API Key` | Store API key securely for the active provider |
| `TokenFlow: Send Optimized Prompt` | Build + optimize context, send to AI, show response |
| `TokenFlow: Show Token Monitor` | Open live usage/cost/savings panel |
| `TokenFlow: Show Before/After Comparison` | Side-by-side token diff |
| `TokenFlow: Reset Session Stats` | Clear session counters |

---

## Provider Comparison

| Provider | Key Required | Free Tier | Best For |
|---|---|---|---|
| **OpenRouter** | Yes (free signup) | ✅ Gemma, Qwen, Llama, Mistral, DeepSeek | Development |
| **Anthropic** | Yes | ❌ | Production, highest quality |
| **Ollama** | ❌ None | ✅ All local models | Offline dev |
| **OpenAI** | Yes | ❌ | GPT-4o/o3 (v2) |
| **Gemini** | Yes | ❌ | Gemini 2.5 (v2) |

### Free models via OpenRouter

| Model | Context | Cost |
|---|---|---|
| `google/gemma-3-12b-it:free` | 32K | $0.00 |
| `qwen/qwen3-8b:free` | 32K | $0.00 (thinking) |
| `deepseek/deepseek-r1:free` | 64K | $0.00 (reasoning) |
| `meta-llama/llama-3.1-8b-instruct:free` | 128K | $0.00 |
| `mistralai/mistral-7b-instruct:free` | 32K | $0.00 |

---

## Optimizer Pipeline

Every prompt passes through 4 stages before reaching the model:

```
1. Comment stripping     (optional — tokenflow.stripComments)
2. Whitespace collapse   (3+ blank lines → 1)
3. Long block truncation (>50 lines → first 25 + last 25 + notice)
4. Section deduplication (same file referenced twice → kept once)
```

**Measured on the TokenFlow AI codebase itself (90 source files, 139,748 raw tokens):**

| Stage | Tokens | Saved |
|---|---|---|
| Raw (all 90 files) | 139,748 | — |
| After whitespace collapse | 139,748 | 0 (already clean) |
| After block truncation | 41,344 | **98,404 (70%)** |
| After deduplication | 41,344 | 0 (no dupes) |
| **Final** | **41,344** | **98,404 tokens — 70%** |

**Cost comparison for one full-context prompt:**

| Model | Without TokenFlow | With TokenFlow | Saved |
|---|---|---|---|
| `google/gemma-3-12b-it:free` | $0.00 | $0.00 | — |
| `claude-3-5-sonnet-20241022` | $0.42 | $0.13 | **$0.29 (70%)** |
| `claude-3-haiku-20240307` | $0.035 | $0.011 | **$0.024 (70%)** |
| `deepseek/deepseek-r1` | $0.077 | $0.023 | **$0.054 (70%)** |

*Run `npm run dogfood` to reproduce these numbers at any time.*

---

## Architecture

```
src/
├── core/
│   ├── domain/          ← AIRequest, AIResponse, WorkspaceContext, TokenUsage
│   └── application/     ← BuildContextUseCase, OptimizeTokensUseCase, ports
│
├── providers/
│   ├── base/            ← IProvider, BaseProvider, ProviderCapabilities, ProviderHealth
│   ├── factory/         ← ProviderFactory (no switch in Registry)
│   ├── registry/        ← ProviderRegistry (hot-switch on config change)
│   ├── middleware/       ← LoggingMiddleware → RetryMiddleware → MetricsMiddleware
│   ├── models/          ← anthropic/openrouter/ollama/openai/gemini + ModelCatalog + PricingCatalog
│   ├── openrouter/      ← OpenRouterProvider (native fetch, SSE streaming)
│   ├── anthropic/       ← AnthropicProvider (@anthropic-ai/sdk)
│   ├── ollama/          ← OllamaProvider (OpenAI-compatible local API)
│   ├── openai/          ← OpenAIProvider (stub — v2)
│   └── gemini/          ← GeminiProvider (stub — v2)
│
├── features/
│   ├── workspace/       ← WorkspaceReader, FileFilter, GitIntegration
│   ├── context/         ← ContextBuilder (serializes WorkspaceContext → prompt)
│   ├── optimizer/       ← TokenOptimizer (4-stage pipeline)
│   ├── tokenMonitor/    ← TokenMonitorPanel (webview), CostEstimator
│   ├── storage/         ← SecretStorageService, SessionStatsService
│   ├── statusBar/       ← TokenStatusBar (compact token/cost indicator)
│   └── settings/        ← ISecretStore, VSCodeSecretStore, SettingsService
│
├── services/
│   ├── pricing/         ← PricingService (session cost accumulation)
│   └── tokenizer/       ← TokenCounter (js-tiktoken + character fallback)
│
└── shared/
    ├── constants/       ← Command IDs, exclusion patterns, thresholds
    ├── errors/          ← TokenFlowError, TokenFlowErrorCode
    ├── events/          ← ProviderEventBus (decouples UI from providers)
    └── utils/           ← Logger
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) and [.ai/ADR/](./.ai/ADR/) for design decisions.

---

## Settings Reference

| Setting | Default | Description |
|---|---|---|
| `tokenflow.provider` | `openrouter` | Active provider |
| `tokenflow.model` | `""` | Override model (empty = provider default) |
| `tokenflow.openrouterModel` | `google/gemma-3-12b-it:free` | OpenRouter default |
| `tokenflow.ollamaModel` | `qwen2.5:latest` | Ollama default |
| `tokenflow.ollamaBaseUrl` | `http://localhost:11434` | Ollama endpoint |
| `tokenflow.maxContextTokens` | `100000` | Hard cap on tokens sent |
| `tokenflow.includeReadme` | `true` | Include README.md in context |
| `tokenflow.stripComments` | `false` | Strip comments (may reduce quality) |

---

## Development

```bash
npm run type-check    # 0 errors
npm run lint          # 0 errors
npm run test          # 84 tests, all passing
npm run build         # esbuild → dist/extension.js
```

### Adding a new provider

1. Create `src/providers/<name>/<Name>Provider.ts` extending `BaseProvider`
2. Add model entries to `src/providers/models/<name>.models.ts`
3. Add pricing to `src/providers/models/PricingCatalog.ts`
4. Add a `case` in `ProviderFactory.createRaw()`
5. Extend the `ProviderName` union in `IProvider.ts`

No other files need to change.

---

## Contributing

Issues and PRs welcome. See [TODO.md](./TODO.md) and [KNOWN_ISSUES.md](./KNOWN_ISSUES.md).

```bash
npm run test:coverage   # View coverage report
npm run format          # Prettier
npm run lint:fix        # ESLint autofix
```

---

## License

MIT — see [LICENSE](./LICENSE)
