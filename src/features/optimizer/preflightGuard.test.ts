// src/features/optimizer/preflightGuard.test.ts — Unit tests for PreflightGuard

import { describe, it, expect } from 'vitest';
import { PreflightGuard } from './preflightGuard';

describe('PreflightGuard', () => {
  // ─── checkTokenCeiling ──────────────────────────────────────────────────────
  describe('checkTokenCeiling()', () => {
    it('passes when token count is within budget', () => {
      const result = PreflightGuard.checkTokenCeiling(50_000, 100_000);
      expect(result.pass).toBe(true);
    });

    it('passes when token count exactly equals the ceiling', () => {
      const result = PreflightGuard.checkTokenCeiling(100_000, 100_000);
      expect(result.pass).toBe(true);
    });

    it('fails when token count exceeds the ceiling', () => {
      const result = PreflightGuard.checkTokenCeiling(110_000, 100_000);
      expect(result.pass).toBe(false);
      expect(result.message).toContain('110,000');
      expect(result.message).toContain('100,000');
    });

    it('passes (disabled) when maxContextTokens is 0', () => {
      const result = PreflightGuard.checkTokenCeiling(999_999, 0);
      expect(result.pass).toBe(true);
    });

    it('passes (disabled) when maxContextTokens is negative', () => {
      const result = PreflightGuard.checkTokenCeiling(999_999, -1);
      expect(result.pass).toBe(true);
    });
  });

  // ─── checkCostBudget ────────────────────────────────────────────────────────
  describe('checkCostBudget()', () => {
    it('passes when both budgets are disabled (0)', () => {
      const result = PreflightGuard.checkCostBudget(0.99, 0, 0);
      expect(result.pass).toBe(true);
      expect(result.hardBlock).toBe(false);
    });

    it('passes when cost is below the soft budget', () => {
      const result = PreflightGuard.checkCostBudget(0.04, 0.05, 0);
      expect(result.pass).toBe(true);
    });

    it('soft-warns when cost meets or exceeds softBudgetUsd', () => {
      const result = PreflightGuard.checkCostBudget(0.05, 0.05, 0);
      expect(result.pass).toBe(false);
      expect(result.hardBlock).toBe(false);
      expect(result.message).toContain('0.0500');
    });

    it('hard-blocks when cost meets or exceeds hardBudgetUsd', () => {
      const result = PreflightGuard.checkCostBudget(0.5, 0, 0.5);
      expect(result.pass).toBe(false);
      expect(result.hardBlock).toBe(true);
      expect(result.message).toContain('blocked');
    });

    it('hard-block takes precedence over soft-warn', () => {
      // cost exceeds both; should be a hard block
      const result = PreflightGuard.checkCostBudget(1.0, 0.05, 0.5);
      expect(result.pass).toBe(false);
      expect(result.hardBlock).toBe(true);
    });

    it('soft-warns when cost is between soft and hard budgets', () => {
      const result = PreflightGuard.checkCostBudget(0.1, 0.05, 0.5);
      expect(result.pass).toBe(false);
      expect(result.hardBlock).toBe(false);
    });
  });
});
