// src/core/domain/entities/TokenUsage.ts — Token usage and cost domain entities

/**
 * Usage data returned from a single AI provider request.
 * Populated from the provider API response (e.g., Anthropic's usage.input_tokens).
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Estimated USD cost for this request. */
  estimatedCostUsd: number;
}

/**
 * Cumulative usage statistics for the current editor session.
 * Persisted locally; reset on explicit user action.
 */
export interface SessionTokenUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  requestCount: number;
  startedAt: Date;
}

/**
 * Pure cost calculation — no external dependencies.
 *
 * @param inputTokens   Number of input (prompt) tokens
 * @param outputTokens  Number of output (completion) tokens
 * @param inputCostPerMToken  USD per 1,000,000 input tokens
 * @param outputCostPerMToken USD per 1,000,000 output tokens
 * @returns Estimated cost in USD
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  inputCostPerMToken: number,
  outputCostPerMToken: number,
): number {
  return (inputTokens * inputCostPerMToken + outputTokens * outputCostPerMToken) / 1_000_000;
}

/** Combines two SessionTokenUsage records (e.g., for multi-session aggregation). */
export function mergeSessionUsage(a: SessionTokenUsage, b: SessionTokenUsage): SessionTokenUsage {
  return {
    totalInputTokens: a.totalInputTokens + b.totalInputTokens,
    totalOutputTokens: a.totalOutputTokens + b.totalOutputTokens,
    totalCostUsd: a.totalCostUsd + b.totalCostUsd,
    requestCount: a.requestCount + b.requestCount,
    startedAt: a.startedAt < b.startedAt ? a.startedAt : b.startedAt,
  };
}
