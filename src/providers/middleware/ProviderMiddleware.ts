// src/providers/middleware/ProviderMiddleware.ts — Abstract base for all middleware
// Delegates all IProvider methods to the wrapped inner provider.
// Concrete middleware only overrides the methods it intercepts.

import type { AIRequest, AIResponse, StreamChunkHandler } from '../../core/domain/AIRequest';
import type { IProvider, ProviderName } from '../base/IProvider';
import type { ProviderCapabilities, ProviderHealth } from '../base/ProviderCapabilities';

/**
 * Base class for the provider middleware pipeline.
 *
 * Pipeline order (outermost → innermost):
 *   LoggingMiddleware → RetryMiddleware → MetricsMiddleware → Provider
 *
 * Each middleware:
 * - Wraps an inner IProvider
 * - Passes through everything it doesn't intercept
 * - Intercepts send() and/or stream() to add cross-cutting behavior
 */
export abstract class ProviderMiddleware implements IProvider {
  constructor(protected readonly inner: IProvider) {}

  // ─── Identity delegation ──────────────────────────────────────────────────

  get name(): ProviderName {
    return this.inner.name;
  }

  get modelId(): string {
    return this.inner.modelId;
  }

  get capabilities(): ProviderCapabilities {
    return this.inner.capabilities;
  }

  // ─── Default pass-through for all IProvider methods ───────────────────────

  connect(): Promise<ProviderHealth> {
    return this.inner.connect();
  }

  isAvailable(): Promise<boolean> {
    return this.inner.isAvailable();
  }

  stream(request: AIRequest, onChunk: StreamChunkHandler): Promise<AIResponse> {
    return this.inner.stream(request, onChunk);
  }

  countTokens(text: string): Promise<number> {
    return this.inner.countTokens(text);
  }

  // ─── Abstract — each middleware must handle the primary dispatch ──────────

  abstract send(request: AIRequest): Promise<AIResponse>;
}
