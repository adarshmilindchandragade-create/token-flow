// src/features/optimizer/tokenOptimizer.ts — Implements IOptimizerPort
// v1 optimizations: whitespace collapse, log truncation, deduplication, optional comment strip

import * as vscode from 'vscode';
import type { IOptimizerPort } from '../../core/application/ports/IContextPort';
import type {
  WorkspaceContext,
  OptimizedContext,
} from '../../core/domain/entities/WorkspaceContext';
import { ContextBuilder } from '../context/contextBuilder';
import { TokenCounter } from '../tokenMonitor/tokenCounter';

/**
 * Reduces token count of serialized workspace context before sending to a provider.
 *
 * v1 optimizations (in order applied):
 * 1. Comment stripping (optional — config.stripComments, off by default)
 * 2. Excessive whitespace collapse (3+ blank lines → 1)
 * 3. Long code block truncation (> 50 lines → first 25 + last 25)
 * 4. Duplicate section elimination
 *
 * Tree-sitter AST compression is deferred to v2 (see ADR-003).
 */
export class TokenOptimizer implements IOptimizerPort {
  private readonly builder = new ContextBuilder();
  private readonly counter = new TokenCounter();

  /** Maximum lines in a single code block before truncation kicks in. */
  private static readonly MAX_BLOCK_LINES = 50;
  private static readonly KEEP_BLOCK_LINES = 25;

  async optimize(context: WorkspaceContext): Promise<OptimizedContext> {
    const config = vscode.workspace.getConfiguration('tokenflow');
    const stripComments = config.get<boolean>('stripComments', false);

    const rawContent = this.builder.serializeContext(context);
    const rawTokenCount = this.counter.count(rawContent);

    let optimized = rawContent;

    if (stripComments) {
      optimized = this.stripComments(optimized);
    }

    optimized = this.collapseWhitespace(optimized);
    optimized = this.truncateLongCodeBlocks(optimized);
    optimized = this.deduplicateSections(optimized);

    const optimizedTokenCount = this.counter.count(optimized);
    const savedTokens = Math.max(0, rawTokenCount - optimizedTokenCount);
    const savingsPercent = rawTokenCount > 0 ? Math.round((savedTokens / rawTokenCount) * 100) : 0;

    return Promise.resolve({
      original: context,
      optimizedContent: optimized,
      rawTokenCount,
      optimizedTokenCount,
      savedTokens,
      savingsPercent,
    });
  }

  /**
   * Strips single-line (//) and block (/* *\/) comments from code content.
   * Also strips Python/shell # comments.
   * Only applied when config.stripComments is true — may affect answer quality.
   */
  stripComments(content: string): string {
    // Block comments: /* ... */
    let result = content.replace(/\/\*[\s\S]*?\*\//g, '');
    // Single-line JS/TS comments: // ...
    result = result.replace(/^\s*\/\/.*$/gm, '');
    // Python/shell # comments (be conservative — don't strip shebangs or markdown)
    result = result.replace(/^(\s*)#(?!\s*!).*$/gm, '$1');
    return result;
  }

  /**
   * Collapses 3 or more consecutive blank lines down to a single blank line.
   */
  collapseWhitespace(content: string): string {
    return content.replace(/\n{3,}/g, '\n\n');
  }

  /**
   * Truncates code blocks longer than MAX_BLOCK_LINES to keep first+last KEEP_BLOCK_LINES.
   * Inserts a truncation notice so the model knows content was removed.
   */
  truncateLongCodeBlocks(content: string): string {
    const max = TokenOptimizer.MAX_BLOCK_LINES;
    const keep = TokenOptimizer.KEEP_BLOCK_LINES;

    return content.replace(/```[\s\S]*?```/g, (block) => {
      const lines = block.split('\n');
      if (lines.length <= max) return block;

      const head = lines.slice(0, keep);
      const tail = lines.slice(-keep);
      const omitted = lines.length - max;
      const notice = `\n... [${omitted} lines omitted by TokenFlow optimizer] ...\n`;

      return [...head, notice, ...tail].join('\n');
    });
  }

  /**
   * Removes duplicate context sections (same relativePath appearing more than once).
   * Uses the section header line as the deduplication key.
   */
  deduplicateSections(content: string): string {
    const sectionSeparator = '\n\n### ';
    const parts = content.split(sectionSeparator);
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const part of parts) {
      // Key = first line of the section (the ### header line)
      const key = part.split('\n')[0] ?? part;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(part);
      }
    }

    return unique.join(sectionSeparator);
  }
}
