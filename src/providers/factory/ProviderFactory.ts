// src/providers/factory/ProviderFactory.ts — Constructs and wraps provider instances
// No switch statements in ProviderRegistry — all provider construction lives here.

import type { IProvider, ProviderName } from '../base/IProvider';
import { OpenRouterProvider } from '../openrouter/OpenRouterProvider';
import { AnthropicProvider } from '../anthropic/AnthropicProvider';
import { OllamaProvider } from '../ollama/OllamaProvider';
import { OpenAIProvider } from '../openai/OpenAIProvider';
import { GeminiProvider } from '../gemini/GeminiProvider';
import { MetricsMiddleware } from '../middleware/MetricsMiddleware';
import { RetryMiddleware } from '../middleware/RetryMiddleware';
import { LoggingMiddleware } from '../middleware/LoggingMiddleware';
import type { ISecretStore } from '../../features/settings/ISecretStore';
import type { ProviderEventBus } from '../../shared/events/ProviderEventBus';
import type { Logger } from '../../shared/utils/logger';
import { ModelCatalog } from '../models/ModelCatalog';
import { TokenFlowError, TokenFlowErrorCode } from '../../shared/errors/TokenFlowError';

/**
 * Configuration needed to construct a provider.
 */
export interface ProviderConfig {
  /** Provider name matching ProviderName union. */
  name: ProviderName;
  /** Model identifier — provider-internal format. */
  modelId: string;
  /** For Ollama: override the base URL (default: http://localhost:11434). */
  ollamaBaseUrl?: string;
}

/**
 * Responsible for constructing provider instances and wrapping them
 * in the middleware pipeline.
 *
 * ProviderRegistry calls only ProviderFactory — it has no provider-specific logic.
 *
 * Middleware pipeline (outermost → innermost):
 *   LoggingMiddleware → RetryMiddleware → MetricsMiddleware → Provider
 *
 * To add a new provider:
 *   1. Create the provider class in src/providers/<name>/
 *   2. Add a case to ProviderFactory.createRaw()
 *   3. Add the provider name to the ProviderName union in IProvider.ts
 */
export class ProviderFactory {
  /**
   * Creates a provider instance and wraps it in the full middleware pipeline.
   * This is the primary entry point — callers should always use this, not createRaw().
   */
  static async create(
    config: ProviderConfig,
    secretStore: ISecretStore,
    eventBus: ProviderEventBus,
    logger: Logger,
  ): Promise<IProvider> {
    const raw = await ProviderFactory.createRaw(config, secretStore);
    return ProviderFactory.wrapWithMiddleware(raw, eventBus, logger);
  }

  /**
   * Constructs a bare provider instance (no middleware).
   * Exported for testing — prefer create() in production code.
   */
  static async createRaw(config: ProviderConfig, secretStore: ISecretStore): Promise<IProvider> {
    const { name, modelId } = config;

    switch (name) {
      case 'openrouter': {
        const key = await secretStore.getApiKey('openrouter');
        if (!key) throw missingKey('openrouter');
        return new OpenRouterProvider(key, modelId);
      }
      case 'anthropic': {
        const key = await secretStore.getApiKey('anthropic');
        if (!key) throw missingKey('anthropic');
        return new AnthropicProvider(key, modelId);
      }
      case 'ollama': {
        // Ollama requires no API key — use base URL from config or default
        return new OllamaProvider(
          modelId || OllamaProvider.DEFAULT_MODEL,
          config.ollamaBaseUrl ?? OllamaProvider.DEFAULT_BASE_URL,
        );
      }
      case 'openai': {
        const key = await secretStore.getApiKey('openai');
        if (!key) throw missingKey('openai');
        return new OpenAIProvider(key, modelId);
      }
      case 'gemini': {
        const key = await secretStore.getApiKey('gemini');
        if (!key) throw missingKey('gemini');
        return new GeminiProvider(key, modelId);
      }
      default: {
        // TypeScript exhaustiveness check
        const _exhaustive: never = name;
        throw new TokenFlowError(
          `Unknown provider: "${String(_exhaustive)}". Check tokenflow.provider setting.`,
          TokenFlowErrorCode.PROVIDER_NOT_CONFIGURED,
        );
      }
    }
  }

  /**
   * Wraps a bare provider in the three-layer middleware pipeline.
   *
   * Pipeline (outermost → innermost):
   *   LoggingMiddleware → RetryMiddleware → MetricsMiddleware → provider
   */
  static wrapWithMiddleware(
    provider: IProvider,
    eventBus: ProviderEventBus,
    logger: Logger,
  ): IProvider {
    const withMetrics = new MetricsMiddleware(provider, eventBus);
    const withRetry = new RetryMiddleware(withMetrics);
    return new LoggingMiddleware(withRetry, logger);
  }

  /**
   * Returns all known ProviderName values.
   * Used by SettingsService to render the provider quick-pick.
   */
  static readonly SUPPORTED_PROVIDERS: ProviderName[] = [
    'openrouter',
    'anthropic',
    'ollama',
    'openai',
    'gemini',
  ];

  /**
   * Returns the default model ID for a provider.
   */
  static defaultModelFor(name: ProviderName): string {
    return ModelCatalog.getDefaultModelId(name);
  }
}

function missingKey(provider: string): TokenFlowError {
  return new TokenFlowError(
    `No API key configured for provider "${provider}". Run "TokenFlow: Set API Key".`,
    TokenFlowErrorCode.PROVIDER_NOT_CONFIGURED,
  );
}
