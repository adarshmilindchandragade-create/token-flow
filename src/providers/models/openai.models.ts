// src/providers/models/openai.models.ts — OpenAI model catalog entries
// Provider is stubbed in v1.1 — NOT_IMPLEMENTED error thrown on use.
// Models listed here are ready for when the provider is wired.

import type { ModelEntry } from './ModelCatalog';

export const OPENAI_MODELS: ModelEntry[] = [
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128_000,
    capabilities: {
      streaming: true,
      vision: true,
      thinking: false,
      tools: true,
      embeddings: false,
    },
    isFree: false,
    isDefault: true,
  },
  {
    id: 'gpt-4.1',
    displayName: 'GPT-4.1',
    provider: 'openai',
    contextWindow: 1_000_000,
    capabilities: {
      streaming: true,
      vision: true,
      thinking: false,
      tools: true,
      embeddings: false,
    },
    isFree: false,
  },
  {
    id: 'o3-mini',
    displayName: 'o3-mini',
    provider: 'openai',
    contextWindow: 200_000,
    capabilities: {
      streaming: true,
      vision: false,
      thinking: true,
      tools: true,
      embeddings: false,
    },
    isFree: false,
  },
  {
    id: 'o4-mini',
    displayName: 'o4-mini',
    provider: 'openai',
    contextWindow: 200_000,
    capabilities: {
      streaming: true,
      vision: true,
      thinking: true,
      tools: true,
      embeddings: false,
    },
    isFree: false,
  },
];
