// src/providers/middleware/MetricsMiddleware.ts — Emits ProviderEventBus events
// Wraps send() and stream() to fire typed events for status bar + token monitor.
// Innermost middleware — closest to the actual provider.

import type { AIRequest, AIResponse, StreamChunkHandler } from '../../core/domain/AIRequest';
import { ProviderMiddleware } from './ProviderMiddleware';
import type { IProvider } from '../base/IProvider';
import type { ProviderEventBus } from '../../shared/events/ProviderEventBus';

let requestCounter = 0;
function nextRequestId(): string {
  return `req-${(++requestCounter).toString().padStart(6, '0')}`;
}

/**
 * Emits structured events to ProviderEventBus for every request lifecycle.
 *
 * Events emitted:
 *   started    — before send/stream is called
 *   chunk      — for each streaming token (stream() only)
 *   completed  — when a full response is available
 *   failed     — when the inner provider throws (after retries exhausted)
 *
 * StatusBar and TokenMonitorPanel subscribe to these events.
 * They never import any provider code directly.
 */
export class MetricsMiddleware extends ProviderMiddleware {
  constructor(
    inner: IProvider,
    private readonly eventBus: ProviderEventBus,
  ) {
    super(inner);
  }

  async send(request: AIRequest): Promise<AIResponse> {
    const requestId = nextRequestId();
    const start = Date.now();

    this.eventBus.dispatch({
      type: 'started',
      requestId,
      provider: this.name,
      model: this.modelId,
      timestamp: new Date(),
    });

    try {
      const response = await this.inner.send(request);

      this.eventBus.dispatch({
        type: 'completed',
        requestId,
        response,
        durationMs: Date.now() - start,
      });

      return response;
    } catch (err) {
      this.eventBus.dispatch({
        type: 'failed',
        requestId,
        provider: this.name,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      throw err;
    }
  }

  override async stream(request: AIRequest, onChunk: StreamChunkHandler): Promise<AIResponse> {
    const requestId = nextRequestId();
    const start = Date.now();

    this.eventBus.dispatch({
      type: 'started',
      requestId,
      provider: this.name,
      model: this.modelId,
      timestamp: new Date(),
    });

    const wrappedChunkHandler: StreamChunkHandler = (chunk) => {
      this.eventBus.dispatch({ type: 'chunk', requestId, content: chunk });
      onChunk(chunk);
    };

    try {
      const response = await this.inner.stream(request, wrappedChunkHandler);

      this.eventBus.dispatch({
        type: 'completed',
        requestId,
        response,
        durationMs: Date.now() - start,
      });

      return response;
    } catch (err) {
      this.eventBus.dispatch({
        type: 'failed',
        requestId,
        provider: this.name,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      throw err;
    }
  }
}
