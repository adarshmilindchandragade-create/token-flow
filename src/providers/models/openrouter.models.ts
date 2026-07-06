// src/providers/models/openrouter.models.ts — OpenRouter model catalog entries
// Static catalog covers well-known paid/premium models and the free router.
// Free model selection is handled dynamically by OpenRouterModelDiscovery.
// Pricing verified: 2026-07-06.

import type { ModelEntry } from './ModelCatalog';

export const OPENROUTER_MODELS: ModelEntry[] = [
  // ─── Free Router (default) ─────────────────────────────────────────────────
  // "openrouter/free" is OpenRouter's built-in auto-selector.
  // It routes to the best currently-available free model automatically.
  // No slug updates needed when OpenRouter changes their free catalog.
  // See: https://openrouter.ai/openrouter/free
  {
    id: 'openrouter/free',
    displayName: 'Free (Auto-selected by OpenRouter)',
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

  // ─── Known free models (discovery populates the full list at runtime) ──────
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

  // ─── Premium models (via OpenRouter, billed to user's OR account) ──────────
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
    displayName: 'Qwen 3 235B (via OpenRouter)',
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
  {
    id: 'google/gemma-3-12b-it',
    displayName: 'Gemma 3 12B (via OpenRouter)',
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
];
