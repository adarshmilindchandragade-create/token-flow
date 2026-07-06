// src/features/providers/providers.test.ts — Unit tests for provider layer

import { describe, it, expect } from 'vitest';
import { CostEstimator } from '../tokenMonitor/costEstimator';
import { TokenFlowErrorCode } from '../../shared/errors/TokenFlowError';

// AnthropicProvider requires a real API key and network access — not unit testable.
// It is covered by integration tests (manual + CI with test credentials).
//
// ProviderRegistry requires VS Code SecretStorage and vscode.workspace APIs.
// It is covered by integration tests.
//
// We test the domain-layer entities and pure logic here.

describe('TokenFlowErrorCode enum', () => {
  it('has PROVIDER_NOT_CONFIGURED code', () => {
    expect(TokenFlowErrorCode.PROVIDER_NOT_CONFIGURED).toBe('PROVIDER_NOT_CONFIGURED');
  });

  it('has PROVIDER_API_ERROR code', () => {
    expect(TokenFlowErrorCode.PROVIDER_API_ERROR).toBe('PROVIDER_API_ERROR');
  });
});

describe('CostEstimator.getContextWindow()', () => {
  const estimator = new CostEstimator();

  it('returns 200_000 for claude-3-5-sonnet', () => {
    expect(estimator.getContextWindow('claude-3-5-sonnet-20241022')).toBe(200_000);
  });

  it('returns a conservative 8_192 for unknown models (not Anthropic\'s 200K fallback)', () => {
    // Bug #3 fix: old behavior returned 200_000 for any unknown model
    expect(estimator.getContextWindow('some-future-model')).toBe(8_192);
  });
});
