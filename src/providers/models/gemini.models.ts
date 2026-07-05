// src/providers/models/gemini.models.ts — Google Gemini model catalog entries
// Provider is stubbed in v1.1 — NOT_IMPLEMENTED error thrown on use.

import type { ModelEntry } from './ModelCatalog';

export const GEMINI_MODELS: ModelEntry[] = [
  {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'gemini',
    contextWindow: 1_000_000,
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
    id: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    provider: 'gemini',
    contextWindow: 1_000_000,
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
