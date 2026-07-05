// src/providers/models/anthropic.models.ts — Anthropic model catalog entries
// Pricing verified: 2026-07-02. Update PricingCatalog when prices change.

import type { ModelEntry } from './ModelCatalog';

export const ANTHROPIC_MODELS: ModelEntry[] = [
  {
    id: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    contextWindow: 200_000,
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
    id: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    contextWindow: 200_000,
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
    id: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
    provider: 'anthropic',
    contextWindow: 200_000,
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
    id: 'claude-3-7-sonnet-20250219',
    displayName: 'Claude 3.7 Sonnet (Thinking)',
    provider: 'anthropic',
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
  {
    id: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku',
    provider: 'anthropic',
    contextWindow: 200_000,
    capabilities: {
      streaming: true,
      vision: true,
      thinking: false,
      tools: true,
      embeddings: false,
    },
    isFree: false,
    isDeprecated: true,
  },
];
