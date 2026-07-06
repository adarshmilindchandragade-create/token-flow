// src/providers/models/openrouter.models.ts — OpenRouter model catalog entries
// OpenRouter exposes 50+ models through a single OpenAI-compatible endpoint.
// Free models (isFree: true) cost $0 — marked with ':free' suffix.
// Pricing verified: 2026-07-06. Note: gemma-3-12b-it:free was removed by OpenRouter.

import type { ModelEntry } from './ModelCatalog';

export const OPENROUTER_MODELS: ModelEntry[] = [
  // ─── Free Tier ────────────────────────────────────────────────────────────
  {
    id: 'google/gemma-3-12b-it',
    displayName: 'Gemma 3 12B (Paid)',
    provider: 'openrouter',
    contextWindow: 32_768,
    capabilities: {
      streaming: true,
      vision: false,
      thinking: false,
      tools: false,
      embeddings: false,
    },
    isFree: false,
  },
  {
    id: 'qwen/qwen3-8b:free',
    displayName: 'Qwen 3 8B (Free)',
    provider: 'openrouter',
    contextWindow: 32_768,
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
    id: 'deepseek/deepseek-r1:free',
    displayName: 'DeepSeek R1 (Free)',
    provider: 'openrouter',
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
    id: 'meta-llama/llama-3.1-8b-instruct:free',
    displayName: 'Llama 3.1 8B Instruct (Free)',
    provider: 'openrouter',
    contextWindow: 131_072,
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
    id: 'mistralai/mistral-7b-instruct:free',
    displayName: 'Mistral 7B Instruct (Free)',
    provider: 'openrouter',
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
  // ─── Paid Tier (via OpenRouter) ───────────────────────────────────────────
  {
    id: 'anthropic/claude-3.5-sonnet',
    displayName: 'Claude 3.5 Sonnet (via OpenRouter)',
    provider: 'openrouter',
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
    id: 'openai/gpt-4o',
    displayName: 'GPT-4o (via OpenRouter)',
    provider: 'openrouter',
    contextWindow: 128_000,
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
    id: 'qwen/qwen3-235b-a22b',
    displayName: 'Qwen 3 235B',
    provider: 'openrouter',
    contextWindow: 131_072,
    capabilities: {
      streaming: true,
      vision: false,
      thinking: true,
      tools: false,
      embeddings: false,
    },
    isFree: false,
  },
];
