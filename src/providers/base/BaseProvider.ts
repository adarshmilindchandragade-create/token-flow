// src/providers/base/BaseProvider.ts — Abstract base class for all AI providers
// Implements default behavior so concrete providers only override what they need.

import type { AIRequest, AIResponse, StreamChunkHandler } from '../../core/domain/AIRequest';
import type { IProvider, ProviderName } from './IProvider';
import type { ProviderCapabilities, ProviderHealth } from './ProviderCapabilities';
import { UNHEALTHY_PROVIDER } from './ProviderCapabilities';
import { ModelCatalog } from '../models/ModelCatalog';

/**
 * Shared base for all provider adapters.
 *
 * Concrete providers must implement:
 *   - name
 *   - modelId
 *   - capabilities
 *   - send()
 *   - isAvailable()
 *
 * Concrete providers may override:
 *   - connect()  — if they need custom health-check logic
 *   - stream()   — if they support real streaming
 *   - countTokens() — if they have a native tokenizer API
 */
export abstract class BaseProvider implements IProvider {
  abstract readonly name: ProviderName;
  abstract readonly modelId: string;
  abstract readonly capabilities: ProviderCapabilities;

  abstract send(request: AIRequest): Promise<AIResponse>;
  abstract isAvailable(): Promise<boolean>;

  /**
   * Default connect() measures isAvailable() latency and returns a ProviderHealth.
   * Override for richer health checks (e.g., verifying model availability).
   */
  async connect(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const available = await this.isAvailable();
      const health: ProviderHealth = {
        connected: available,
        authenticated: available,
        modelAvailable: available,
        latencyMs: Date.now() - start,
        lastCheckedAt: new Date(),
      };
      if (!available) {
        health.error = `Provider ${this.name} is not reachable.`;
      }
      return health;
    } catch (err) {
      return {
        ...UNHEALTHY_PROVIDER,
        latencyMs: Date.now() - start,
        lastCheckedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Default stream() falls back to send() for providers without streaming support.
   * Providers that support streaming should override this.
   */
  async stream(request: AIRequest, onChunk: StreamChunkHandler): Promise<AIResponse> {
    if (!this.capabilities.streaming) {
      // Non-streaming provider: deliver the full response as a single synthetic chunk
      const response = await this.send(request);
      onChunk(response.content);
      return response;
    }
    // Streaming provider that hasn't overridden: should not happen — override stream()
    return this.send(request);
  }

  /**
   * Default token counting: character-count / 4 heuristic.
   * Accurate enough for display; providers with native tokenizers should override.
   * Factor of 4 is the conventional approximation for English/code text.
   */
  async countTokens(text: string): Promise<number> {
    return Promise.resolve(Math.ceil(text.length / 4));
  }

  // ─── Shared helpers available to all subclasses ───────────────────────────

  /**
   * Calculates estimated cost using the global PricingCatalog.
   * Providers can call this after receiving usage data from the API.
   */
  protected estimateCost(inputTokens: number, outputTokens: number): number {
    return ModelCatalog.estimateCost(this.modelId, inputTokens, outputTokens);
  }

  /**
   * Returns the context window size for the active model from ModelCatalog.
   * Falls back to 100,000 for unknown models.
   */
  get contextWindowSize(): number {
    return ModelCatalog.getModel(this.modelId)?.contextWindow ?? 100_000;
  }

  /**
   * Returns input cost per M tokens from PricingCatalog.
   */
  get inputCostPerMToken(): number {
    return ModelCatalog.getPricing(this.modelId).inputCostPerMToken;
  }

  /**
   * Returns output cost per M tokens from PricingCatalog.
   */
  get outputCostPerMToken(): number {
    return ModelCatalog.getPricing(this.modelId).outputCostPerMToken;
  }

  /**
   * Builds the messages array for an AIRequest, prepending system prompt as a
   * separate system message if the provider supports it, or as the first user turn.
   */
  protected buildMessages(request: AIRequest): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    for (const msg of request.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    return messages;
  }
}
