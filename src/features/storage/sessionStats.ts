// src/features/storage/sessionStats.ts — Local session cost tracking

import type * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { SessionTokenUsage, TokenUsage } from '../../core/domain/entities/TokenUsage';
import { Logger } from '../../shared/utils/logger';

const STATS_FILENAME = 'session-stats.json';

/**
 * Persists cumulative token usage stats to a local JSON file in globalStorageUri.
 * Stats are reset per session (or on explicit user command).
 *
 * Why local JSON, not in-memory only:
 * The panel and status bar need stats even after a VS Code restart within the same session.
 * globalStorageUri is the correct VS Code API for per-extension local storage.
 */
export class SessionStatsService {
  private stats: SessionTokenUsage;
  private readonly filePath: string;
  private readonly logger = Logger.getInstance();

  constructor(globalStorageUri: vscode.Uri) {
    this.filePath = path.join(globalStorageUri.fsPath, STATS_FILENAME);
    this.stats = this.loadStats();
  }

  /**
   * Adds usage from a single provider response to the cumulative session total.
   * Persists to disk after each update.
   */
  recordUsage(usage: TokenUsage): void {
    this.stats.totalInputTokens += usage.inputTokens;
    this.stats.totalOutputTokens += usage.outputTokens;
    this.stats.totalCostUsd += usage.estimatedCostUsd;
    this.stats.requestCount += 1;
    this.persist();
  }

  /** Returns a snapshot of current session stats. */
  getStats(): SessionTokenUsage {
    return { ...this.stats };
  }

  /** Resets session stats to zero and persists. */
  resetSession(): void {
    this.stats = this.freshStats();
    this.persist();
    this.logger.info('Session stats reset.');
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private loadStats(): SessionTokenUsage {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as SessionTokenUsage;
        // Convert startedAt from string back to Date
        parsed.startedAt = new Date(parsed.startedAt);
        return parsed;
      }
    } catch {
      this.logger.warn('Could not load session stats — starting fresh.');
    }
    return this.freshStats();
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.stats, null, 2), 'utf-8');
    } catch {
      this.logger.warn('Could not persist session stats — in-memory state still accurate.');
    }
  }

  private freshStats(): SessionTokenUsage {
    return {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      requestCount: 0,
      startedAt: new Date(),
    };
  }
}
