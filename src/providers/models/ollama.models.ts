// src/providers/models/ollama.models.ts — Ollama local model catalog entries
// These are common models pullable via `ollama pull <id>`.
// No pricing — Ollama runs locally at zero API cost.

import type { ModelEntry } from './ModelCatalog';

export const OLLAMA_MODELS: ModelEntry[] = [
  {
    id: 'qwen2.5:latest',
    displayName: 'Qwen 2.5 (Local)',
    provider: 'ollama',
    contextWindow: 32_768,
    capabilities: {
      streaming: true,
      vision: false,
      thinking: false,
      tools: false,
      embeddings: false,
    },
    isFree: true,
    isDefault: true,
  },
  {
    id: 'llama3.2:latest',
    displayName: 'Llama 3.2 (Local)',
    provider: 'ollama',
    contextWindow: 131_072,
    capabilities: {
      streaming: true,
      vision: false,
      thinking: false,
      tools: false,
      embeddings: false,
    },
    isFree: true,
  },
  {
    id: 'deepseek-r1:latest',
    displayName: 'DeepSeek R1 (Local)',
    provider: 'ollama',
    contextWindow: 64_000,
    capabilities: {
      streaming: true,
      vision: false,
      thinking: true,
      tools: false,
      embeddings: false,
    },
    isFree: true,
  },
  {
    id: 'mistral:latest',
    displayName: 'Mistral (Local)',
    provider: 'ollama',
    contextWindow: 32_768,
    capabilities: {
      streaming: true,
      vision: false,
      thinking: false,
      tools: false,
      embeddings: false,
    },
    isFree: true,
  },
  {
    id: 'gemma3:latest',
    displayName: 'Gemma 3 (Local)',
    provider: 'ollama',
    contextWindow: 32_768,
    capabilities: {
      streaming: true,
      vision: false,
      thinking: false,
      tools: false,
      embeddings: false,
    },
    isFree: true,
  },
  {
    id: 'codellama:latest',
    displayName: 'Code Llama (Local)',
    provider: 'ollama',
    contextWindow: 16_384,
    capabilities: {
      streaming: true,
      vision: false,
      thinking: false,
      tools: false,
      embeddings: false,
    },
    isFree: true,
  },
];
