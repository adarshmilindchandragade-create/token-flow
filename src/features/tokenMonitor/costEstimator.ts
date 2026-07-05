// src/features/tokenMonitor/costEstimator.ts — Hardcoded pricing table for v1

import { calculateCost } from '../../core/domain/entities/TokenUsage';

interface ModelPricing {
  inputCostPerMToken: number;   // USD per 1,000,000 input tokens
  outputCostPerMToken: number;  // USD per 1,000,000 output tokens
  contextWindow: number;
}

/**
 * Hardcoded pricing table for v1.
 * Updated manually when Anthropic changes pricing.
 * See KNOWN_ISSUES.md for the tradeoff discussion.
 *
 * Source: https://www.anthropic.com/pricing (verified 2026-07-01)
 */
const MODEL_PRICING: Readonly<Record<string, ModelPricing>> = {
  // ─── Claude 3.5 family ────────────────────────────────────────────────
  'claude-3-5-sonnet-20241022': {
    inputCostPerMToken: 3.0,
    outputCostPerMToken: 15.0,
    contextWindow: 200_000,
  },
  'claude-3-5-haiku-20241022': {
    inputCostPerMToken: 0.8,
    outputCostPerMToken: 4.0,
    contextWindow: 200_000,
  },
  // ─── Claude 3 family ──────────────────────────────────────────────────
  'claude-3-opus-20240229': {
    inputCostPerMToken: 15.0,
    outputCostPerMToken: 75.0,
    contextWindow: 200_000,
  },
  'claude-3-sonnet-20240229': {
    inputCostPerMToken: 3.0,
    outputCostPerMToken: 15.0,
    contextWindow: 200_000,
  },
  'claude-3-haiku-20240307': {
    inputCostPerMToken: 0.25,
    outputCostPerMToken: 1.25,
    contextWindow: 200_000,
  },
};

/** Fallback when a model is not in the pricing table. */
const DEFAULT_PRICING: ModelPricing = {
  inputCostPerMToken: 3.0,
  outputCostPerMToken: 15.0,
  contextWindow: 200_000,
};

/**
 * Estimates cost and retrieves pricing metadata for AI model usage.
 * All methods are pure — no I/O, fully testable.
 */
export class CostEstimator {
  getPricing(modelId: string): ModelPricing {
    return MODEL_PRICING[modelId] ?? DEFAULT_PRICING;
  }

  getContextWindow(modelId: string): number {
    return this.getPricing(modelId).contextWindow;
  }

  /**
   * Returns estimated USD cost for a single request.
   */
  estimateCost(inputTokens: number, outputTokens: number, modelId: string): number {
    const { inputCostPerMToken, outputCostPerMToken } = this.getPricing(modelId);
    return calculateCost(inputTokens, outputTokens, inputCostPerMToken, outputCostPerMToken);
  }

  /**
   * Formats a USD cost value for display.
   * Shows '<$0.001' for very small amounts to avoid misleading precision.
   */
  formatCost(costUsd: number): string {
    if (costUsd === 0) return '$0.00';
    if (costUsd < 0.001) return '<$0.001';
    if (costUsd < 0.01) return `$${costUsd.toFixed(4)}`;
    return `$${costUsd.toFixed(3)}`;
  }

  /**
   * Returns a health indicator string for a given token count relative to the context window.
   */
  getContextHealth(tokenCount: number, modelId: string): '🟢' | '🟡' | '🔴' {
    const window = this.getContextWindow(modelId);
    const fraction = tokenCount / window;
    if (fraction < 0.33) return '🟢';
    if (fraction < 0.66) return '🟡';
    return '🔴';
  }
}
