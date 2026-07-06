// src/features/tokenMonitor/tokenMonitor.test.ts — Unit tests for token monitor feature

import { describe, it, expect } from 'vitest';
import { CostEstimator } from './costEstimator';

// TokenCounter uses WASM (tiktoken) which is not available in the test environment.
// It falls back to the character-count path, exercised indirectly here.
// TokenMonitorPanel requires VS Code webview APIs — covered by integration tests.

describe('CostEstimator', () => {
  const estimator = new CostEstimator();

  // ─── getContextWindow ────────────────────────────────────────────────────
  // Bug #3 fix: previously delegated to an Anthropic-only local table, so any
  // non-Anthropic model returned 200_000. Now delegates to ModelCatalog.
  describe('getContextWindow()', () => {
    it('returns 200_000 for claude-3-5-sonnet-20241022', () => {
      expect(estimator.getContextWindow('claude-3-5-sonnet-20241022')).toBe(200_000);
    });

    it('returns the correct window for a known OpenRouter model (not 200_000)', () => {
      // google/gemma-3-12b-it:free has a 32,768-token context window.
      // Before Bug #3 fix it would return 200_000 (wrong Anthropic fallback).
      const window = estimator.getContextWindow('google/gemma-3-12b-it:free');
      expect(window).toBeGreaterThan(0);
      expect(window).not.toBe(200_000);
    });

    it('returns a conservative fallback (8_192) for truly unknown models', () => {
      expect(estimator.getContextWindow('some-unknown-future-model-xyz')).toBe(8_192);
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

    it('returns 0 for free models (OpenRouter :free tier)', () => {
      expect(estimator.estimateCost(10_000, 2_000, 'google/gemma-3-12b-it:free')).toBe(0);
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

    it('correctly reads Gemma context window for health (Bug #3 regression guard)', () => {
      // google/gemma-3-12b-it has a 32,768-token window in the catalog.
      // At 15,000 tokens that's 45% → 🟡.
      // Before the fix, CostEstimator used Anthropic's 200K fallback → 7.5% → 🟢 (wrong).
      const health = estimator.getContextHealth(15_000, 'google/gemma-3-12b-it');
      expect(health).toBe('🟡');
    });
  });
});
