// src/features/tokenMonitor/costEstimator.ts — Delegates to PricingCatalog + ModelCatalog
//
// Bug #3 fix: the previous version maintained its own hardcoded pricing table with only
// 5 Anthropic models. Any non-Anthropic model fell back to contextWindow: 200_000,
// causing the context-health indicator (🟢/🟡/🔴) to always show green for OpenRouter/
// Ollama users (e.g., Gemma-12b has a 32,768-token window, not 200K).
//
// The table is now deleted. All data is sourced from PricingCatalog (costs) and
// ModelCatalog (context windows), which already have correct data for all providers.
//
// Public method shapes are preserved exactly so TokenStatusBar and existing tests
// require no call-site changes (ADR-005 migration plan, step 1).

import { PricingCatalog } from '../../providers/models/PricingCatalog';
import { ModelCatalog } from '../../providers/models/ModelCatalog';
import { calculateCost } from '../../core/domain/entities/TokenUsage';

/**
 * Composed shape matching the pre-ADR-005 ModelPricing interface.
 * Both callers of getPricing() (tokenMonitor.test.ts, features/providers/providers.test.ts)
 * assert on contextWindow — so we compose it here rather than exposing PricingEntry
 * (which has no contextWindow field). See PHASE-1-DESIGN.md §4.3.
 */
interface ModelPricing {
  inputCostPerMToken: number;
  outputCostPerMToken: number;
  contextWindow: number;
}

/**
 * Conservative fallback for truly unknown models.
 * Deliberately smaller than any real production model window (8,192 < 32,768)
 * so an unrecognized model triggers an early 🔴 rather than a misleading 🟢.
 * (Old fallback was 200_000 — Anthropic's window — which masked context
 * overflow for every non-Anthropic provider. Bug #3 root cause.)
 */
const CONSERVATIVE_FALLBACK_WINDOW = 8_192;

/**
 * Estimates cost and retrieves pricing metadata for AI model usage.
 * Delegates to PricingCatalog and ModelCatalog — no local pricing table.
 * All methods are pure — no I/O, fully testable.
 */
export class CostEstimator {
  /**
   * Returns composed pricing + context-window data for the given model.
   * Composes PricingCatalog (costs) + ModelCatalog (contextWindow) into
   * the existing ModelPricing shape so call sites need no changes.
   */
  getPricing(modelId: string): ModelPricing {
    const pricing = PricingCatalog.forModel(modelId);
    const contextWindow =
      ModelCatalog.getModel(modelId)?.contextWindow ?? CONSERVATIVE_FALLBACK_WINDOW;
    return {
      inputCostPerMToken: pricing.inputCostPerMToken,
      outputCostPerMToken: pricing.outputCostPerMToken,
      contextWindow,
    };
  }

  /**
   * Returns the context window size for the given model ID.
   * Uses ModelCatalog for known models; falls back to CONSERVATIVE_FALLBACK_WINDOW
   * for truly unknown models.
   */
  getContextWindow(modelId: string): number {
    return ModelCatalog.getModel(modelId)?.contextWindow ?? CONSERVATIVE_FALLBACK_WINDOW;
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
