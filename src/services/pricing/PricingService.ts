// src/services/pricing/PricingService.ts — Session and lifetime cost tracking
// Pure class — no VS Code dependencies. Receives usage data from AIResponse events.

import { PricingCatalog } from '../../providers/models/PricingCatalog';

export interface RequestCostRecord {
  requestId: string;
  provider: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  timestampMs: number;
  latencyMs: number;
}

export interface SessionSummary {
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  totalSavedTokens: number;
  avgLatencyMs: number;
  providers: string[];
}

/**
 * Accumulates token usage and cost data across a VS Code session.
 * Populated by MetricsMiddleware via ProviderEventBus events.
 * Consumed by TokenMonitorPanel and SessionStatsService.
 */
export class PricingService {
  private readonly records: RequestCostRecord[] = [];
  private totalSavedTokens = 0;

  /**
   * Record a completed request. Called by MetricsMiddleware after each response.
   */
  record(data: RequestCostRecord): void {
    this.records.push(data);
  }

  /**
   * Adds optimizer-reported token savings to the session total.
   */
  addSavedTokens(count: number): void {
    this.totalSavedTokens += count;
  }

  /**
   * Returns a snapshot of all session metrics.
   */
  getSessionSummary(): SessionSummary {
    const totalInputTokens = this.records.reduce((s, r) => s + r.inputTokens, 0);
    const totalOutputTokens = this.records.reduce((s, r) => s + r.outputTokens, 0);
    const totalCostUsd = this.records.reduce((s, r) => s + r.estimatedCostUsd, 0);
    const avgLatencyMs =
      this.records.length > 0
        ? this.records.reduce((s, r) => s + r.latencyMs, 0) / this.records.length
        : 0;
    const providers = [...new Set(this.records.map((r) => r.provider))];

    return {
      requestCount: this.records.length,
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      totalCostUsd,
      totalSavedTokens: this.totalSavedTokens,
      avgLatencyMs: Math.round(avgLatencyMs),
      providers,
    };
  }

  /**
   * Estimates the cost for a given model and token counts.
   * Delegates to PricingCatalog — useful for pre-flight estimates.
   */
  static estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    return PricingCatalog.estimateCost(modelId, inputTokens, outputTokens);
  }

  /**
   * Resets all session data.
   */
  reset(): void {
    this.records.length = 0;
    this.totalSavedTokens = 0;
  }

  /**
   * Returns the total number of recorded requests.
   */
  get requestCount(): number {
    return this.records.length;
  }

  /** v2 stub: persist session data to disk for daily/lifetime tracking. */
  async saveSessionAsync(): Promise<void> {
    // TODO(v2): serialize records to storage for daily/lifetime aggregation
    return Promise.resolve();
  }
}
