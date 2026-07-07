// src/providers/models/gemini.models.ts — Google Gemini model catalog entries
// All models accessible via a single AI Studio API key (free tier available).
// Free tier: rate-limited but no billing required. See: aistudio.google.com
// Pricing verified: 2026-07-07

import type { ModelEntry } from './ModelCatalog';

export const GEMINI_MODELS: ModelEntry[] = [
  // ─── Default: Flash (fast, free tier, 1M context) ─────────────────────────
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
    isFree: true, // free-tier via AI Studio (rate limited)
    isDefault: true,
  },
  // ─── Pro: Best reasoning, long context ────────────────────────────────────
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
  // ─── Flash Lite: Fastest, lightweight tasks ────────────────────────────────
  {
    id: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    provider: 'gemini',
    contextWindow: 1_000_000,
    capabilities: {
      streaming: true,
      vision: true,
      thinking: false,
      tools: true,
      embeddings: false,
    },
    isFree: true,
  },
  // ─── 1.5 Flash: Stable, well-tested ───────────────────────────────────────
  {
    id: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    provider: 'gemini',
    contextWindow: 1_000_000,
    capabilities: {
      streaming: true,
      vision: true,
      thinking: false,
      tools: true,
      embeddings: false,
    },
    isFree: true,
  },
];
