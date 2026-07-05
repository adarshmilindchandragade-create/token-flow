// src/features/statusBar/tokenStatusBar.ts — Compact status bar token/cost indicator

import * as vscode from 'vscode';
import type { SessionTokenUsage } from '../../core/domain/entities/TokenUsage';
import { CostEstimator } from '../tokenMonitor/costEstimator';
import { COMMAND_SHOW_MONITOR } from '../../shared/constants';

/**
 * Displays a compact token usage + cost summary in the VS Code status bar.
 * Clicking it opens the Token Monitor panel.
 *
 * States:
 * - Idle:        "⚡ TokenFlow"
 * - Configured:  "⚡ TokenFlow [anthropic]"
 * - Active:      "⚡ 12,540 tokens · $0.042"
 * - Error:       "⚡ TokenFlow: Error" (red background)
 */
export class TokenStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private readonly estimator = new CostEstimator();

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100, // Priority — higher = further right
    );
    this.item.command = COMMAND_SHOW_MONITOR;
    this.item.accessibilityInformation = { label: 'TokenFlow AI status bar item' };
    this.setIdle();
    this.item.show();
  }

  /** Sets idle state before any provider is configured. */
  setIdle(): void {
    this.item.text = '$(circuit-board) TokenFlow';
    this.item.tooltip = 'TokenFlow AI — Click to open token monitor';
    this.item.backgroundColor = undefined;
    this.item.color = undefined;
  }

  /** Shows configured provider name. */
  setProvider(providerName: string, modelId?: string): void {
    const modelLabel = modelId ? ` (${this.truncateModel(modelId)})` : '';
    this.item.text = `$(circuit-board) TokenFlow [${providerName}${modelLabel}]`;
    this.item.tooltip = new vscode.MarkdownString(
      `**TokenFlow AI**\n\nProvider: \`${providerName}\`${modelId ? `\nModel: \`${modelId}\`` : ''}\n\nClick to open token monitor`,
    );
  }

  /** Updates with live session stats after a provider response. */
  update(stats: SessionTokenUsage, modelId?: string): void {
    const totalTokens = stats.totalInputTokens + stats.totalOutputTokens;
    const cost = this.estimator.formatCost(stats.totalCostUsd);
    const health = modelId
      ? this.estimator.getContextHealth(stats.totalInputTokens, modelId)
      : '🟢';

    this.item.text = `$(circuit-board) ${health} ${totalTokens.toLocaleString()} · ${cost}`;
    this.item.tooltip = new vscode.MarkdownString(
      [
        '**TokenFlow AI — Session**',
        '',
        `| | |`,
        `|---|---|`,
        `| Input tokens | ${stats.totalInputTokens.toLocaleString()} |`,
        `| Output tokens | ${stats.totalOutputTokens.toLocaleString()} |`,
        `| Total cost | ${cost} |`,
        `| Requests | ${stats.requestCount} |`,
        '',
        '*Click to open token monitor*',
      ].join('\n'),
    );
  }

  /** Shows error state with red background. */
  setError(message?: string): void {
    this.item.text = `$(error) TokenFlow: ${message ?? 'Error'}`;
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  }

  dispose(): void {
    this.item.dispose();
  }

  private truncateModel(modelId: string): string {
    // "claude-3-5-sonnet-20241022" → "sonnet-3.5"
    if (modelId.includes('sonnet')) return 'sonnet';
    if (modelId.includes('haiku')) return 'haiku';
    if (modelId.includes('opus')) return 'opus';
    return modelId.split('-')[0] ?? modelId;
  }
}
