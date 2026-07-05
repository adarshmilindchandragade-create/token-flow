// src/providers/middleware/LoggingMiddleware.ts — Structured request/response logging
// Outermost middleware — logs before entering the pipeline and after it exits.

import type { AIRequest, AIResponse, StreamChunkHandler } from '../../core/domain/AIRequest';
import { ProviderMiddleware } from './ProviderMiddleware';
import type { IProvider } from '../base/IProvider';
import type { Logger } from '../../shared/utils/logger';

/**
 * Logs provider request and response details to the TokenFlow output channel.
 * Positioned outermost in the pipeline so it captures the full round-trip including retries.
 *
 * Log format:
 *   [TokenFlow] → openrouter/google/gemma-3-12b-it:free  (prompt: 1,234 chars)
 *   [TokenFlow] ✓ openrouter/google/gemma-3-12b-it:free  842ms  in:312 out:88 $0.000
 *   [TokenFlow] ✗ openrouter/google/gemma-3-12b-it:free  Error: ...
 */
export class LoggingMiddleware extends ProviderMiddleware {
  constructor(
    inner: IProvider,
    private readonly logger: Logger,
  ) {
    super(inner);
  }

  async send(request: AIRequest): Promise<AIResponse> {
    const promptLength = request.messages.reduce((s, m) => s + m.content.length, 0);
    this.logger.info(
      `→ ${this.name}/${this.modelId}  (prompt: ${promptLength.toLocaleString()} chars)`,
    );

    const start = Date.now();
    try {
      const response = await this.inner.send(request);
      const ms = Date.now() - start;
      const cost =
        response.usage.estimatedCostUsd < 0.001
          ? '<$0.001'
          : `$${response.usage.estimatedCostUsd.toFixed(4)}`;

      this.logger.info(
        `✓ ${this.name}/${this.modelId}  ${ms}ms` +
          `  in:${response.usage.inputTokens} out:${response.usage.outputTokens} ${cost}`,
      );
      return response;
    } catch (err) {
      this.logger.error(
        `✗ ${this.name}/${this.modelId}  ${Date.now() - start}ms`,
        err instanceof Error ? err : undefined,
      );
      throw err;
    }
  }

  override async stream(request: AIRequest, onChunk: StreamChunkHandler): Promise<AIResponse> {
    const promptLength = request.messages.reduce((s, m) => s + m.content.length, 0);
    this.logger.info(
      `→ ${this.name}/${this.modelId} [stream]  (prompt: ${promptLength.toLocaleString()} chars)`,
    );

    const start = Date.now();
    try {
      const response = await this.inner.stream(request, onChunk);
      this.logger.info(
        `✓ ${this.name}/${this.modelId} [stream]  ${Date.now() - start}ms` +
          `  out:${response.usage.outputTokens}`,
      );
      return response;
    } catch (err) {
      this.logger.error(
        `✗ ${this.name}/${this.modelId} [stream]  ${Date.now() - start}ms`,
        err instanceof Error ? err : undefined,
      );
      throw err;
    }
  }
}
