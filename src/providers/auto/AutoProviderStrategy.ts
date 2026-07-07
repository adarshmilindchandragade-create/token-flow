// src/providers/auto/AutoProviderStrategy.ts
// Implements "auto" provider mode: tries providers in priority order,
// falls back automatically on quota exhaustion (429), unavailability, or 404.
//
// Priority (default):
//   1. Gemini     — AI Studio free tier, generous quota, low latency
//   2. OpenRouter — free model auto-router (openrouter/free)
//   3. Ollama     — offline / local (no key needed)
//   4. Anthropic  — paid, if key configured
//   5. OpenAI     — paid, if key configured

import type { IProvider, ProviderName } from '../base/IProvider';
import type { AIRequest, AIResponse, StreamChunkHandler } from '../../core/domain/AIRequest';
import type { ProviderCapabilities, ProviderHealth } from '../base/ProviderCapabilities';
import { ProviderFactory, type ProviderConfig } from '../factory/ProviderFactory';
import type { ISecretStore } from '../../features/settings/ISecretStore';
import type { ProviderEventBus } from '../../shared/events/ProviderEventBus';
import type { Logger } from '../../shared/utils/logger';
import { TokenFlowError, TokenFlowErrorCode } from '../../shared/errors/TokenFlowError';

/** Default provider priority when tokenflow.provider is "auto". */
export const DEFAULT_AUTO_PRIORITY: ProviderName[] = [
  'gemini',
  'openrouter',
  'ollama',
  'anthropic',
  'openai',
];

/** Status codes / keywords that trigger fallback to next provider. */
const FALLBACK_TRIGGERS = [
  '429',
  'quota',
  'resource_exhausted',
  'unavailable',
  'not found',
  '404',
  '503',
];

function isFallbackError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return FALLBACK_TRIGGERS.some((t) => msg.includes(t));
}

/**
 * AutoProviderStrategy wraps multiple providers and tries them in order.
 * It implements IProvider so it is transparent to all callers.
 *
 * The UI/commands never know which underlying provider is active —
 * they just call send() / stream() and get a response.
 */
export class AutoProviderStrategy implements IProvider {
  readonly name: ProviderName = 'openrouter'; // reported name of whichever provider responded
  readonly modelId: string = 'auto';
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    vision: true,
    thinking: true,
    tools: true,
    embeddings: false,
  };

  private activeProvider: IProvider | null = null;
  private candidateProviders: IProvider[] = [];

  constructor(private readonly logger: Logger) {}

  // ─── Initialization ────────────────────────────────────────────────────────

  /**
   * Build the ordered list of available providers.
   * A provider is included if:
   *   - it has a key configured (or needs no key, like Ollama), AND
   *   - it responds to isAvailable()
   */
  static async build(
    priority: ProviderName[],
    secretStore: ISecretStore,
    eventBus: ProviderEventBus,
    logger: Logger,
  ): Promise<AutoProviderStrategy> {
    const strategy = new AutoProviderStrategy(logger);
    const candidates: IProvider[] = [];

    for (const name of priority) {
      try {
        const modelId = ProviderFactory.defaultModelFor(name);
        const config: ProviderConfig = { name, modelId };
        const provider = await ProviderFactory.create(config, secretStore, eventBus, logger);
        candidates.push(provider);
        logger.info(`[Auto] Provider "${name}" added to candidate list`);
      } catch (err) {
        // Missing key or construction error — skip silently
        logger.info(
          `[Auto] Provider "${name}" skipped: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (candidates.length === 0) {
      throw new TokenFlowError(
        'Auto mode: no providers configured. Run "TokenFlow: Set API Key" to add at least one.',
        TokenFlowErrorCode.PROVIDER_NOT_CONFIGURED,
      );
    }

    strategy.candidateProviders = candidates;
    strategy.activeProvider = candidates[0];
    logger.info(`[Auto] ${candidates.length} provider(s) ready. Primary: ${candidates[0].name}`);
    return strategy;
  }

  // ─── IProvider implementation ──────────────────────────────────────────────

  async connect(): Promise<ProviderHealth> {
    if (!this.activeProvider) {
      return {
        connected: false,
        authenticated: false,
        modelAvailable: false,
        latencyMs: 0,
        lastCheckedAt: new Date(),
        error: 'No providers available',
      };
    }
    return this.activeProvider.connect();
  }

  isAvailable(): Promise<boolean> {
    return Promise.resolve(this.candidateProviders.length > 0);
  }

  async send(request: AIRequest): Promise<AIResponse> {
    return this.tryWithFallback((provider) => provider.send(request));
  }

  async stream(request: AIRequest, onChunk: StreamChunkHandler): Promise<AIResponse> {
    return this.tryWithFallback((provider) => provider.stream(request, onChunk));
  }

  async countTokens(text: string): Promise<number> {
    const p = this.activeProvider;
    if (!p) return Math.ceil(text.length / 4);
    return p.countTokens(text);
  }

  // ─── Fallback engine ───────────────────────────────────────────────────────

  private async tryWithFallback(
    action: (provider: IProvider) => Promise<AIResponse>,
    startIndex = 0,
  ): Promise<AIResponse> {
    for (let i = startIndex; i < this.candidateProviders.length; i++) {
      const provider = this.candidateProviders[i];
      try {
        const result = await action(provider);
        // Promote this provider to active if it succeeded
        if (this.activeProvider !== provider) {
          this.logger.info(`[Auto] Switched to provider "${provider.name}" (recovered)`);
          this.activeProvider = provider;
        }
        return result;
      } catch (err) {
        if (isFallbackError(err) && i + 1 < this.candidateProviders.length) {
          this.logger.warn(
            `[Auto] Provider "${provider.name}" failed (fallback trigger). Trying "${this.candidateProviders[i + 1].name}"...`,
          );
          continue;
        }
        // Non-fallback error (e.g. invalid request) or last provider — rethrow
        throw err;
      }
    }

    throw new TokenFlowError(
      'Auto mode: all providers failed. Check your API keys and network connection.',
      TokenFlowErrorCode.PROVIDER_API_ERROR,
    );
  }
}
