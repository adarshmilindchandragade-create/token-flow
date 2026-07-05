// src/features/optimizer/beforeAfterDiff.ts — Before/after report builder

import type { OptimizedContext } from '../../core/domain/entities/WorkspaceContext';

export interface BeforeAfterReport {
  rawTokenCount: number;
  optimizedTokenCount: number;
  savedTokens: number;
  savingsPercent: number;
  /** The optimized content string, ready to include in a prompt. */
  optimizedContent: string;
  /** Human-readable summary for display in the token monitor panel. */
  summary: string;
  /** Detailed breakdown lines for the Before/After comparison view. */
  breakdownLines: string[];
}

/**
 * Builds a human-readable before/after report from an OptimizedContext.
 * Pure function — no I/O or VS Code dependencies.
 */
export class BeforeAfterDiff {
  buildReport(context: OptimizedContext): BeforeAfterReport {
    const breakdownLines = this.buildBreakdownLines(context);

    return {
      rawTokenCount: context.rawTokenCount,
      optimizedTokenCount: context.optimizedTokenCount,
      savedTokens: context.savedTokens,
      savingsPercent: context.savingsPercent,
      optimizedContent: context.optimizedContent,
      summary: this.buildSummary(context),
      breakdownLines,
    };
  }

  private buildSummary(ctx: OptimizedContext): string {
    const { rawTokenCount, optimizedTokenCount, savedTokens, savingsPercent } = ctx;
    return [
      `Before: ${rawTokenCount.toLocaleString()} tokens`,
      `After:  ${optimizedTokenCount.toLocaleString()} tokens`,
      `Saved:  ${savedTokens.toLocaleString()} tokens (${savingsPercent}%)`,
    ].join('\n');
  }

  private buildBreakdownLines(ctx: OptimizedContext): string[] {
    const lines: string[] = [
      `Raw context:       ${ctx.rawTokenCount.toLocaleString()} tokens`,
      `Optimized context: ${ctx.optimizedTokenCount.toLocaleString()} tokens`,
      `Tokens saved:      ${ctx.savedTokens.toLocaleString()} (${ctx.savingsPercent}%)`,
      '',
      'Context sources:',
    ];

    const { original } = ctx;
    if (original.activeFile) {
      lines.push(`  Active file:  ${original.activeFile.relativePath}`);
    }
    if (original.changedFiles.length > 0) {
      lines.push(`  Changed files: ${original.changedFiles.map((f) => f.relativePath).join(', ')}`);
    }
    if (original.importedFiles.length > 0) {
      lines.push(`  Imported files: ${original.importedFiles.map((f) => f.relativePath).join(', ')}`);
    }
    if (original.readme) {
      lines.push(`  README: included`);
    }
    if (original.gitDiff) {
      lines.push(`  Git diff: included`);
    }

    return lines;
  }
}
