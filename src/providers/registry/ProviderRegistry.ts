// src/providers/registry/ProviderRegistry.ts — Manages the active AI provider
// Delegates all provider construction to ProviderFactory — zero switch statements here.
// Supports hot-switching via onDidChangeConfiguration.

import * as vscode from 'vscode';
import type { IProvider, ProviderName } from '../base/IProvider';
import { ProviderFactory } from '../factory/ProviderFactory';
import type { ISecretStore } from '../../features/settings/ISecretStore';
import type { ProviderEventBus } from '../../shared/events/ProviderEventBus';
import { TokenFlowError, TokenFlowErrorCode } from '../../shared/errors/TokenFlowError';
import { Logger } from '../../shared/utils/logger';
import { ModelCatalog } from '../models/ModelCatalog';

/**
 * Single source of truth for the active AI provider.
 *
 * Responsibilities:
 *   - Read provider + model from VS Code configuration
 *   - Delegate construction to ProviderFactory
 *   - Return the active provider to command handlers
 *   - Support hot-switching when settings change (no restart needed)
 *   - List which providers have API keys configured
 */
export class ProviderRegistry {
  private activeProvider: IProvider | null = null;
  private readonly logger = Logger.getInstance();

  constructor(
    private readonly secretStore: ISecretStore,
    private readonly eventBus: ProviderEventBus,
  ) {}

  /**
   * Reads configuration + secrets and constructs the active provider via ProviderFactory.
   * Safe to call multiple times — re-initializes when settings change.
   * Returns false if initialization fails (missing key, unavailable provider, etc.).
   */
  async initialize(): Promise<boolean> {
    const config = vscode.workspace.getConfiguration('tokenflow');
    const providerName = config.get<ProviderName>('provider', 'auto');

    // Determine the model ID: prefer explicit tokenflow.model setting,
    // fall back to provider-specific setting, then catalog default.
    const modelId = this.resolveModelId(config, providerName);

    const ollamaBaseUrl = config.get<string>('ollamaBaseUrl', OllamaProvider_DEFAULT_BASE_URL);

    try {
      this.activeProvider = await ProviderFactory.create(
        { name: providerName, modelId, ollamaBaseUrl },
        this.secretStore,
        this.eventBus,
        this.logger,
      );

      this.logger.info(`Provider initialized: ${providerName} / ${modelId}`);
      return true;
    } catch (err) {
      if (
        err instanceof TokenFlowError &&
        err.code === TokenFlowErrorCode.PROVIDER_NOT_CONFIGURED
      ) {
        this.logger.warn(err.message);
      } else {
        this.logger.error('Provider initialization failed', err instanceof Error ? err : undefined);
      }
      this.activeProvider = null;
      return false;
    }
  }

  // ─── Provider access ──────────────────────────────────────────────────────

  /** Returns the active provider, or null if not yet configured. */
  getActiveProvider(): IProvider | null {
    return this.activeProvider;
  }

  /**
   * Returns the active provider or throws TokenFlowError.
   * Use in command handlers where a provider is required.
   */
  requireActiveProvider(): IProvider {
    if (!this.activeProvider) {
      throw new TokenFlowError(
        'No provider configured. Run "TokenFlow: Set API Key" first.',
        TokenFlowErrorCode.PROVIDER_NOT_CONFIGURED,
      );
    }
    return this.activeProvider;
  }

  // ─── Discovery ────────────────────────────────────────────────────────────

  /**
   * Returns the configured provider name, or 'openrouter' as default.
   */
  getActiveProviderName(): ProviderName {
    return this.activeProvider?.name ?? 'openrouter';
  }

  /**
   * Returns all supported provider names.
   */
  getSupportedProviders(): ProviderName[] {
    return ProviderFactory.SUPPORTED_PROVIDERS;
  }

  /**
   * Returns which providers have API keys configured (or need none, like ollama).
   */
  async listConfiguredProviders(): Promise<ProviderName[]> {
    const results: ProviderName[] = [];
    for (const provider of ProviderFactory.SUPPORTED_PROVIDERS) {
      if (provider === 'ollama') {
        results.push(provider); // no key required
      } else if (await this.secretStore.hasApiKey(provider)) {
        results.push(provider);
      }
    }
    return results;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private resolveModelId(config: vscode.WorkspaceConfiguration, provider: ProviderName): string {
    // 1. Explicit tokenflow.model setting
    const explicit = config.get<string>('model', '');
    if (explicit) return explicit;

    // 2. Provider-specific model setting
    const providerModel = config.get<string>(`${provider}Model`, '');
    if (providerModel) return providerModel;

    // 3. Catalog default for this provider
    return ModelCatalog.getDefaultModelId(provider);
  }
}

// Inline constant to avoid circular import with OllamaProvider at this layer
const OllamaProvider_DEFAULT_BASE_URL = 'http://localhost:11434';
