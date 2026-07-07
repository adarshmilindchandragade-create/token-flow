// src/features/optimizer/preflightGuard.ts — Pre-send budget guardrails
//
// Pure class — no vscode imports. All VS Code UI (warning dialogs, blocking) lives
// in extension.ts. This class is responsible only for rule evaluation.
//
// Two independent rules:
//   1. Token ceiling  — warns when optimized context exceeds tokenflow.maxContextTokens
//   2. Cost budget    — warns (soft) or blocks (hard) based on estimated pre-send cost

export interface PreflightResult {
  /** True if the rule passes (no action needed). */
  pass: boolean;
  /** Human-readable warning/block message when pass is false. */
  message?: string;
}

export interface CostPreflightResult extends PreflightResult {
  /** True if this is a hard block (no "Send anyway" option). */
  hardBlock: boolean;
}

/**
 * Evaluates pre-send guardrail rules against an optimized context.
 *
 * Rule 1 — Token ceiling:
 *   Fails when optimizedTokenCount > maxContextTokens (and maxContextTokens > 0).
 *   Note: TokenOptimizer.enforceTokenBudget() already hard-truncates the content,
 *   so this rule fires only when the budget was disabled during optimization but
 *   re-enabled here, or when a separate maxContextTokens ceiling is in use as a
 *   user-facing warning rather than a silent truncation.
 *
 * Rule 2 — Cost budget:
 *   softBudgetUsd > 0: warns, user can "Send anyway".
 *   hardBudgetUsd > 0: blocks, no "Send anyway". Hard evaluated first.
 *   Both 0: disabled.
 */
export class PreflightGuard {
  /**
   * Checks whether the optimized token count fits within the configured ceiling.
   * @param optimizedTokenCount  Token count after optimization
   * @param maxContextTokens     Ceiling from tokenflow.maxContextTokens; 0 = disabled
   */
  static checkTokenCeiling(optimizedTokenCount: number, maxContextTokens: number): PreflightResult {
    if (maxContextTokens <= 0 || optimizedTokenCount <= maxContextTokens) {
      return { pass: true };
    }
    return {
      pass: false,
      message:
        `Optimized context is ${optimizedTokenCount.toLocaleString()} tokens, ` +
        `which exceeds your tokenflow.maxContextTokens limit of ${maxContextTokens.toLocaleString()}. ` +
        `The content has been truncated automatically, but you may want to review the Before/After view.`,
    };
  }

  /**
   * Checks whether the estimated pre-send cost fits within the configured budget.
   * @param estimatedCostUsd  Pre-send cost estimate (input tokens only — output unknown)
   * @param softBudgetUsd     Warn threshold in USD; 0 = disabled
   * @param hardBudgetUsd     Block threshold in USD; 0 = disabled
   */
  static checkCostBudget(
    estimatedCostUsd: number,
    softBudgetUsd: number,
    hardBudgetUsd: number,
  ): CostPreflightResult {
    // Hard block evaluated first (stricter)
    if (hardBudgetUsd > 0 && estimatedCostUsd >= hardBudgetUsd) {
      return {
        pass: false,
        hardBlock: true,
        message:
          `Estimated cost $${estimatedCostUsd.toFixed(4)} exceeds your hard budget limit ` +
          `of $${hardBudgetUsd.toFixed(4)} (tokenflow.hardBudgetUsd). Send blocked.`,
      };
    }

    // Soft warning (user can override)
    if (softBudgetUsd > 0 && estimatedCostUsd >= softBudgetUsd) {
      return {
        pass: false,
        hardBlock: false,
        message:
          `Estimated cost $${estimatedCostUsd.toFixed(4)} exceeds your soft budget ` +
          `of $${softBudgetUsd.toFixed(4)} (tokenflow.softBudgetUsd).`,
      };
    }

    return { pass: true, hardBlock: false };
  }
}
