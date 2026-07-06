// src/features/tokenMonitor/costEstimator.ts — Delegates to PricingCatalog + ModelCatalog
//
// Bug #3 fix: the previous version maintained its own hardcoded pricing table with only
// 5 Anthropic models. Any non-Anthropic model fell back to contextWindow: 200_000,
// causing the context-health indicator (🟢/🟡/🔴) to always show green for OpenRouter/
// Ollama users (e.g., Gemma-12b has a 32,768-token window, not 200K).
//
// The table is now deleted. All data is sourced from PricingCatalog (costs) and
// ModelCatalog (context windows), which already have correct data for all providers.
// The class is kept as a thin wrapper to preserve call sites in TokenStatusBar and tests.

import { PricingCatalog } from '../../providers/models/PricingCatalog';
import { ModelCatalog } from '../../providers/models/ModelCatalog';
import { calculateCost } from '../../core/domain/entities/TokenUsage';

/**
 * Estimates cost and retrieves pricing metadata for AI model usage.
 * Delegates to PricingCatalog and ModelCatalog — no local pricing table.
 * All methods are pure — no I/O, fully testable.
 */
export class CostEstimator {
  /**
   * Returns the context window size for the given model ID.
   * Uses ModelCatalog for known models; falls back to a conservative 8,192
   * for truly unknown models (avoids the old 200K Anthropic-only default
   * that caused incorrect health readings for OpenRouter/Ollama models).
   */
  getContextWindow(modelId: string): number {
    return ModelCatalog.getModel(modelId)?.contextWindow ?? 8_192;
  }

  /**
   * Returns estimated USD cost for a single request.
   */
  estimateCost(inputTokens: number, outputTokens: number, modelId: string): number {
    const { inputCostPerMToken, outputCostPerMToken } = PricingCatalog.forModel(modelId);
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
