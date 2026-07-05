// src/services/pricing/pricing.test.ts — Unit tests for PricingService

import { describe, it, expect, beforeEach } from 'vitest';
import { PricingService } from './PricingService';
import type { RequestCostRecord } from './PricingService';

const makeRecord = (overrides: Partial<RequestCostRecord> = {}): RequestCostRecord => ({
  requestId: 'req-001',
  provider: 'openrouter',
  modelId: 'google/gemma-3-12b-it:free',
  inputTokens: 500,
  outputTokens: 100,
  totalTokens: 600,
  estimatedCostUsd: 0,
  timestampMs: Date.now(),
  latencyMs: 200,
  ...overrides,
});

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  it('starts with zero request count', () => {
    expect(service.requestCount).toBe(0);
  });

  it('records requests correctly', () => {
    service.record(makeRecord({ inputTokens: 1_000, outputTokens: 200, estimatedCostUsd: 0.01 }));
    expect(service.requestCount).toBe(1);
  });

  it('accumulates token counts across requests', () => {
    service.record(makeRecord({ inputTokens: 1_000, outputTokens: 200, estimatedCostUsd: 0 }));
    service.record(makeRecord({ inputTokens: 500, outputTokens: 100, estimatedCostUsd: 0 }));

    const summary = service.getSessionSummary();
    expect(summary.totalInputTokens).toBe(1_500);
    expect(summary.totalOutputTokens).toBe(300);
    expect(summary.totalTokens).toBe(1_800);
    expect(summary.requestCount).toBe(2);
  });

  it('accumulates cost correctly', () => {
    service.record(makeRecord({ estimatedCostUsd: 0.0045 }));
    service.record(makeRecord({ estimatedCostUsd: 0.002 }));

    const summary = service.getSessionSummary();
    expect(summary.totalCostUsd).toBeCloseTo(0.0065, 6);
  });

  it('tracks saved tokens', () => {
    service.addSavedTokens(1_200);
    service.addSavedTokens(300);

    const summary = service.getSessionSummary();
    expect(summary.totalSavedTokens).toBe(1_500);
  });

  it('lists unique providers', () => {
    service.record(makeRecord({ provider: 'openrouter' }));
    service.record(makeRecord({ provider: 'anthropic' }));
    service.record(makeRecord({ provider: 'openrouter' }));

    const summary = service.getSessionSummary();
    expect(summary.providers).toHaveLength(2);
    expect(summary.providers).toContain('openrouter');
    expect(summary.providers).toContain('anthropic');
  });

  it('calculates average latency', () => {
    service.record(makeRecord({ latencyMs: 200 }));
    service.record(makeRecord({ latencyMs: 400 }));

    const summary = service.getSessionSummary();
    expect(summary.avgLatencyMs).toBe(300);
  });

  it('resets all data on reset()', () => {
    service.record(makeRecord());
    service.addSavedTokens(500);
    service.reset();

    const summary = service.getSessionSummary();
    expect(summary.requestCount).toBe(0);
    expect(summary.totalTokens).toBe(0);
    expect(summary.totalSavedTokens).toBe(0);
    expect(service.requestCount).toBe(0);
  });

  it('static estimateCost returns 0 for free models', () => {
    const cost = PricingService.estimateCost('google/gemma-3-12b-it:free', 10_000, 500);
    expect(cost).toBe(0);
  });

  it('static estimateCost calculates correctly for paid models', () => {
    // claude-3-5-sonnet: $3/M input, $15/M output
    const cost = PricingService.estimateCost('claude-3-5-sonnet-20241022', 1_000_000, 0);
    expect(cost).toBeCloseTo(3.0, 4);
  });
});
