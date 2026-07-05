// src/features/tokenMonitor/tokenMonitor.test.ts — Unit tests for token monitor feature

import { describe, it, expect } from 'vitest';
import { CostEstimator } from './costEstimator';

// TokenCounter uses WASM (tiktoken) which is not available in the test environment.
// It's covered by the character-fallback path, tested indirectly via CostEstimator usage.
// TokenMonitorPanel requires VS Code webview APIs — covered by integration tests.

describe('CostEstimator', () => {
  const estimator = new CostEstimator();

  // ─── getPricing ─────────────────────────────────────────────────────────
  describe('getPricing()', () => {
    it('returns known pricing for claude-3-5-sonnet-20241022', () => {
      const pricing = estimator.getPricing('claude-3-5-sonnet-20241022');
      expect(pricing.inputCostPerMToken).toBe(3.0);
      expect(pricing.outputCostPerMToken).toBe(15.0);
      expect(pricing.contextWindow).toBe(200_000);
    });

    it('returns default pricing for unknown models', () => {
      const pricing = estimator.getPricing('unknown-model-xyz');
      expect(pricing.inputCostPerMToken).toBeGreaterThan(0);
      expect(pricing.contextWindow).toBeGreaterThan(0);
    });
  });

  // ─── estimateCost ────────────────────────────────────────────────────────
  describe('estimateCost()', () => {
    it('calculates cost correctly for claude-3-5-sonnet', () => {
      // 1000 input + 500 output @ $3/$15 per M tokens
      // = (1000 * 3 + 500 * 15) / 1_000_000 = 0.003 + 0.0075 = 0.0105
      const cost = estimator.estimateCost(1000, 500, 'claude-3-5-sonnet-20241022');
      expect(cost).toBeCloseTo(0.0105, 6);
    });

    it('returns 0 for zero tokens', () => {
      expect(estimator.estimateCost(0, 0, 'claude-3-5-sonnet-20241022')).toBe(0);
    });

    it('handles large token counts without overflow', () => {
      const cost = estimator.estimateCost(100_000, 50_000, 'claude-3-5-sonnet-20241022');
      expect(isFinite(cost)).toBe(true);
      expect(cost).toBeGreaterThan(0);
    });
  });

  // ─── formatCost ──────────────────────────────────────────────────────────
  describe('formatCost()', () => {
    it('shows $0.00 for zero cost', () => {
      expect(estimator.formatCost(0)).toBe('$0.00');
    });

    it('shows <$0.001 for very small amounts', () => {
      expect(estimator.formatCost(0.0005)).toBe('<$0.001');
    });

    it('formats small amounts to 4 decimal places', () => {
      expect(estimator.formatCost(0.0042)).toBe('$0.0042');
    });

    it('formats larger amounts to 3 decimal places', () => {
      expect(estimator.formatCost(1.234)).toBe('$1.234');
    });
  });

  // ─── getContextHealth ────────────────────────────────────────────────────
  describe('getContextHealth()', () => {
    it('returns 🟢 for < 33% of context window', () => {
      expect(estimator.getContextHealth(50_000, 'claude-3-5-sonnet-20241022')).toBe('🟢');
    });

    it('returns 🟡 for 33–66% of context window', () => {
      expect(estimator.getContextHealth(100_000, 'claude-3-5-sonnet-20241022')).toBe('🟡');
    });

    it('returns 🔴 for > 66% of context window', () => {
      expect(estimator.getContextHealth(160_000, 'claude-3-5-sonnet-20241022')).toBe('🔴');
    });
  });
});
