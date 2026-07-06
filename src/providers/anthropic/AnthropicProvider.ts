// src/providers/anthropic/AnthropicProvider.ts — Anthropic Claude provider (production)
// Uses @anthropic-ai/sdk. v1.2: overrides countTokens() with the real count_tokens
// endpoint instead of BaseProvider's chars/4 fallback (see KNOWN_ISSUES.md).

import Anthropic from '@anthropic-ai/sdk';
import type { AIRequest, AIResponse, StreamChunkHandler } from '../../core/domain/AIRequest';
import type { ProviderCapabilities } from '../base/ProviderCapabilities';
import { BaseProvider } from '../base/BaseProvider';
import { ModelCatalog } from '../models/ModelCatalog';
import { TokenFlowError, TokenFlowErrorCode } from '../../shared/errors/TokenFlowError';

export class AnthropicProvider extends BaseProvider {
  static readonly DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

  readonly name = 'anthropic' as const;

  readonly capabilities: ProviderCapabilities;

  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly modelId: string = AnthropicProvider.DEFAULT_MODEL,
  ) {
    super();
    this.client = new Anthropic({ apiKey });
    this.capabilities = ModelCatalog.getModel(modelId)?.capabilities ?? {
      streaming: true,
      vision: true,
      thinking: false,
      tools: true,
      embeddings: false,
    };
  }

  // ─── IProvider implementation ─────────────────────────────────────────────

  async send(request: AIRequest): Promise<AIResponse> {
    const start = Date.now();
    const model = request.model ?? this.modelId;

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: request.maxTokens ?? 4096,
        ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const content = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;

      return {
        content,
        model: response.model,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          estimatedCostUsd: this.estimateCost(inputTokens, outputTokens),
        },
        stopReason: response.stop_reason ?? null,
        provider: this.name,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        throw new TokenFlowError(
          `Anthropic API error ${err.status}: ${err.message}`,
          TokenFlowErrorCode.PROVIDER_API_ERROR,
        );
      }
      throw err;
    }
  }

  async stream(request: AIRequest, onChunk: StreamChunkHandler): Promise<AIResponse> {
    const start = Date.now();
    const model = request.model ?? this.modelId;
    let fullContent = '';
    let stopReason: string | null = null;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const stream = this.client.messages.stream({
        model,
        max_tokens: request.maxTokens ?? 4096,
        ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const delta = event.delta.text;
          fullContent += delta;
          onChunk(delta);
        } else if (event.type === 'message_delta') {
          stopReason = event.delta.stop_reason ?? null;
          outputTokens = event.usage.output_tokens;
        } else if (event.type === 'message_start') {
          inputTokens = event.message.usage.input_tokens;
        }
      }
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        throw new TokenFlowError(
          `Anthropic streaming error ${err.status}: ${err.message}`,
          TokenFlowErrorCode.PROVIDER_API_ERROR,
        );
      }
      throw err;
    }

    return {
      content: fullContent,
      model,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCostUsd: this.estimateCost(inputTokens, outputTokens),
      },
      stopReason,
      provider: this.name,
      latencyMs: Date.now() - start,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: this.modelId,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Overrides BaseProvider's chars/4 heuristic with Anthropic's real token-counting
   * endpoint. As of @anthropic-ai/sdk ^0.32.0 this endpoint lives under the `beta`
   * namespace (client.beta.messages.countTokens) — it has since been promoted to
   * stable in newer SDK releases, so this override should move to
   * `client.messages.countTokens(...)` once the SDK dependency is upgraded past
   * the point where that method is stable (verify via CHANGELOG before upgrading).
   *
   * Falls back to the inherited heuristic on any failure (network error, rate
   * limit, unsupported model) so a counting failure never blocks the caller —
   * accurate-but-unavailable is worse than approximate-but-working here.
   */
  override async countTokens(text: string): Promise<number> {
    try {
      const response = await this.client.beta.messages.countTokens({
        model: this.modelId,
        messages: [{ role: 'user', content: text }],
      });
      return response.input_tokens;
    } catch {
      return super.countTokens(text);
    }
  }
}
