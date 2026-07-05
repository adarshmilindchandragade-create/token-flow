// src/providers/middleware/RetryMiddleware.ts — Exponential backoff retry wrapper
// Retries failed send() calls with jittered exponential delay.
// Positioned between LoggingMiddleware and MetricsMiddleware in the pipeline.

import type { AIRequest, AIResponse } from '../../core/domain/AIRequest';
import { ProviderMiddleware } from './ProviderMiddleware';
import type { IProvider } from '../base/IProvider';
import { TokenFlowError, TokenFlowErrorCode } from '../../shared/errors/TokenFlowError';

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1_000;
const MAX_JITTER_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err: unknown): boolean {
  // Don't retry on authentication failures, not-implemented stubs, or validation errors
  if (err instanceof TokenFlowError) {
    return (
      err.code !== TokenFlowErrorCode.PROVIDER_NOT_CONFIGURED &&
      err.code !== TokenFlowErrorCode.NOT_IMPLEMENTED &&
      err.code !== TokenFlowErrorCode.GIT_NOT_AVAILABLE
    );
  }
  // Retry on network errors (fetch failures, timeouts)
  return true;
}

/**
 * Wraps send() with exponential backoff retry logic.
 * Does NOT retry stream() — partial streams are non-idempotent.
 * Uses jitter to avoid thundering-herd retries.
 *
 * Retry schedule (base 1s):
 *   Attempt 1: immediate
 *   Attempt 2: ~1s  + jitter
 *   Attempt 3: ~2s  + jitter
 *   Attempt 4: ~4s  + jitter
 */
export class RetryMiddleware extends ProviderMiddleware {
  constructor(
    inner: IProvider,
    private readonly maxRetries: number = DEFAULT_MAX_RETRIES,
    private readonly baseDelayMs: number = DEFAULT_BASE_DELAY_MS,
  ) {
    super(inner);
  }

  async send(request: AIRequest): Promise<AIResponse> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.inner.send(request);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (!isRetryable(err) || attempt === this.maxRetries) {
          throw lastError;
        }

        const delay = this.baseDelayMs * Math.pow(2, attempt) + Math.random() * MAX_JITTER_MS;
        await sleep(delay);
      }
    }

    // Should never reach here, but TypeScript needs this
    throw (
      lastError ??
      new TokenFlowError(
        'RetryMiddleware exhausted all attempts.',
        TokenFlowErrorCode.PROVIDER_API_ERROR,
      )
    );
  }
}
