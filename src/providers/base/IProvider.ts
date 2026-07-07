// src/providers/base/IProvider.ts — Enhanced AI provider contract
// All provider adapters implement this interface.
// Replaces src/core/domain/interfaces/IProvider.ts (which is now a re-export shim).

import type { AIRequest, AIResponse, StreamChunkHandler } from '../../core/domain/AIRequest';
import type { ProviderCapabilities, ProviderHealth } from './ProviderCapabilities';

export type { AIRequest, AIResponse, StreamChunkHandler };
export type { ProviderCapabilities, ProviderHealth };

/**
 * All registered provider names.
 * Adding a new provider: extend this union + add a case to ProviderFactory.
 */
export type ProviderName = 'auto' | 'openrouter' | 'anthropic' | 'ollama' | 'openai' | 'gemini';

/**
 * Contract for every AI provider adapter.
 *
 * To add a provider (v2+):
 * 1. Create `src/providers/<name>/<Name>Provider.ts` extending BaseProvider
 * 2. Add the provider name to ProviderName union
 * 3. Add a case to ProviderFactory.create()
 * 4. Add model entries to `src/providers/models/<name>.models.ts`
 * No other modules need to change.
 */
export interface IProvider {
  // ─── Identity ─────────────────────────────────────────────────────────────

  /** Provider name — matches ProviderName union. */
  readonly name: ProviderName;
  /** Active model identifier (provider's internal model ID). */
  readonly modelId: string;
  /** Structured capability record for this provider+model combination. */
  readonly capabilities: ProviderCapabilities;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Warm up the provider connection and validate credentials.
   * Returns a ProviderHealth snapshot for diagnostics.
   * Called by ProviderRegistry.initialize() after construction.
   */
  connect(): Promise<ProviderHealth>;

  /**
   * Returns true if the provider is reachable and credentials are valid.
   * Cheaper than connect() — no health record overhead.
   */
  isAvailable(): Promise<boolean>;

  // ─── Request handling ─────────────────────────────────────────────────────

  /**
   * Send a request and receive a complete (non-streaming) response.
   * All providers must implement this.
   */
  send(request: AIRequest): Promise<AIResponse>;

  /**
   * Send a request and stream the response token-by-token.
   * `onChunk` receives incremental text (not cumulative).
   * Returns a complete AIResponse after streaming finishes.
   * Providers that don't support streaming fall back to send().
   */
  stream(request: AIRequest, onChunk: StreamChunkHandler): Promise<AIResponse>;

  /**
   * Count tokens for the given text using the provider's native tokenizer.
   * May use a fast local approximation if a network call is too slow.
   */
  countTokens(text: string): Promise<number>;
}
