// src/shared/types/index.ts — Shared TypeScript types for TokenFlow AI

/**
 * Supported AI providers.
 * v1: anthropic only.
 * v2+: extend union — 'openai' | 'ollama'
 */
export type ProviderName = 'anthropic';

/**
 * Detected task type used by the RCTF wrapper for system prompt selection.
 * Populated by keyword heuristics in the prompt text.
 */
export type TaskType = 'bug' | 'feature' | 'refactor' | 'explain' | 'unknown';

/**
 * User-facing extension configuration (mirrors package.json contributes.configuration).
 */
export interface TokenFlowConfig {
  provider: ProviderName;
  model: string;
  maxContextTokens: number;
  includeReadme: boolean;
  stripComments: boolean;
}

/**
 * Context health tier for the 3-tier context health system.
 */
export type ContextHealth = 'low' | 'moderate' | 'high';
