// src/features/optimizer/tokenOptimizer.ts — Implements IOptimizerPort
// v1 optimizations: whitespace collapse, log truncation, deduplication, optional comment strip
// v1.2: enforces tokenflow.maxContextTokens as a final budget-safety stage (was previously dead config)

import * as vscode from 'vscode';
import type { IOptimizerPort } from '../../core/application/ports/IContextPort';
import type {
  WorkspaceContext,
  OptimizedContext,
} from '../../core/domain/entities/WorkspaceContext';
import { ContextBuilder } from '../context/contextBuilder';
import { TokenCounter } from '../tokenMonitor/tokenCounter';
import { DEFAULT_MAX_CONTEXT_TOKENS } from '../../shared/constants';

/**
 * Reduces token count of serialized workspace context before sending to a provider.
 *
 * v1 optimizations (in order applied):
 * 1. Comment stripping (optional — config.stripComments, off by default)
 * 2. Excessive whitespace collapse (3+ blank lines → 1)
 * 3. Long code block truncation (> 50 lines → first 25 + last 25)
 * 4. Duplicate section elimination
 * 5. Hard budget enforcement against tokenflow.maxContextTokens (v1.2)
 *
 * Tree-sitter AST compression is intentionally deferred — see CLAUDE.md
 * ("Do not implement AST-based optimization until the simpler pipeline is validated").
 */
export class TokenOptimizer implements IOptimizerPort {
  private readonly builder = new ContextBuilder();
  private readonly counter = new TokenCounter();

  /** Maximum lines in a single code block before truncation kicks in. */
  private static readonly MAX_BLOCK_LINES = 50;
  private static readonly KEEP_BLOCK_LINES = 25;

  /** Section separator convention shared with ContextBuilder.serializeContext(). */
  private static readonly SECTION_SEPARATOR = '\n\n### ';

  /**
   * Section-header prefixes considered droppable when over budget, ordered
   * from lowest priority (dropped first) to higher priority. README, Git Diff,
   * and Active File are never dropped by this stage — only hard-truncated as a
   * last resort — since they represent what the user is actually asking about.
   */
  private static readonly DROPPABLE_TIERS: readonly string[][] = [
    ['Imported File:'],
    ['Changed File:'],
  ];

  async optimize(context: WorkspaceContext): Promise<OptimizedContext> {
    const config = vscode.workspace.getConfiguration('tokenflow');
    const stripComments = config.get<boolean>('stripComments', false);
    const maxContextTokens = config.get<number>('maxContextTokens', DEFAULT_MAX_CONTEXT_TOKENS);

    const rawContent = this.builder.serializeContext(context);
    const rawTokenCount = this.counter.count(rawContent);

    let optimized = rawContent;

    if (stripComments) {
      optimized = this.stripComments(optimized);
    }

    optimized = this.collapseWhitespace(optimized);
    optimized = this.truncateLongCodeBlocks(optimized);
    optimized = this.deduplicateSections(optimized);
    optimized = this.enforceTokenBudget(optimized, maxContextTokens);

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
    let result = content.replace(/\/\*[\s\S]*?\*\//g, '');
    result = result.replace(/^\s*\/\/.*$/gm, '');
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
    const sectionSeparator = TokenOptimizer.SECTION_SEPARATOR;
    const parts = content.split(sectionSeparator);
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const part of parts) {
      const key = part.split('\n')[0] ?? part;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(part);
      }
    }

    return unique.join(sectionSeparator);
  }

  /**
   * Enforces tokenflow.maxContextTokens as a hard ceiling on the serialized context.
   *
   * Strategy (cheapest / least destructive first):
   * 1. No-op if already within budget or budget is disabled (<= 0).
   * 2. Drop whole "Imported File" sections (lowest priority — depth-1 dependencies).
   * 3. Drop whole "Changed File" sections (broader diff context).
   * 4. Hard-truncate what remains (README / Git Diff / Active File) as a last resort,
   *    appending a visible notice so the model — and the user — know content was cut.
   *
   * This runs *after* the other stages, so it only ever removes what whitespace
   * collapse, block truncation, and dedup left behind.
   */
  enforceTokenBudget(content: string, maxTokens: number): string {
    if (maxTokens <= 0 || this.counter.count(content) <= maxTokens) {
      return content;
    }

    let result = content;
    for (const tier of TokenOptimizer.DROPPABLE_TIERS) {
      result = this.dropSectionsByPrefix(result, tier);
      if (this.counter.count(result) <= maxTokens) {
        return result;
      }
    }

    return this.hardTruncateToBudget(result, maxTokens);
  }

  /**
   * Removes entire sections whose header starts with any of the given prefixes
   * (e.g. "Imported File:"). Uses the same "### "-delimited section convention
   * as ContextBuilder.serializeContext() / deduplicateSections().
   */
  private dropSectionsByPrefix(content: string, prefixes: string[]): string {
    const sep = TokenOptimizer.SECTION_SEPARATOR;
    const parts = content.split(sep).map((part) => (part.startsWith('### ') ? part : `### ${part}`));

    const kept = parts.filter((part) => {
      const header = part.replace(/^### /, '').split('\n')[0] ?? '';
      return !prefixes.some((prefix) => header.startsWith(prefix));
    });

    return kept.join('\n\n');
  }

  /**
   * Last-resort truncation: binary-searches the largest character prefix of
   * `content` whose token count fits within `maxTokens` (minus the notice's
   * own cost), then appends a visible truncation notice.
   */
  private hardTruncateToBudget(content: string, maxTokens: number): string {
    const notice =
      '\n\n> ⚠️ TokenFlow: additional content omitted — exceeded tokenflow.maxContextTokens.\n';
    const budget = Math.max(0, maxTokens - this.counter.count(notice));

    if (budget <= 0) {
      return notice.trim();
    }

    let low = 0;
    let high = content.length;
    while (low < high) {
      const mid = Math.ceil((low + high + 1) / 2);
      if (this.counter.count(content.slice(0, mid)) <= budget) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    return content.slice(0, low) + notice;
  }
}
