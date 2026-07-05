// src/features/settings/SettingsService.ts — Provider and model selection UI
// Exposes VS Code quick-picks for switching providers + models without restart.

import * as vscode from 'vscode';
import type { ProviderName } from '../../providers/base/IProvider';
import type { ProviderRegistry } from '../../providers/registry/ProviderRegistry';
import type { ISecretStore } from './ISecretStore';
import { ProviderFactory } from '../../providers/factory/ProviderFactory';
import { ModelCatalog } from '../../providers/models/ModelCatalog';

/** Display metadata for each provider in the quick-pick. */
const PROVIDER_DISPLAY: Record<ProviderName, { label: string; detail: string }> = {
  openrouter: { label: '🌐 OpenRouter', detail: 'Free models available · Best for development' },
  anthropic: { label: '🤖 Anthropic', detail: 'Claude Sonnet / Haiku / Opus · Production quality' },
  ollama: { label: '🖥️ Ollama', detail: 'Local inference · No API key · No internet required' },
  openai: { label: '🧠 OpenAI', detail: 'GPT-4o / o3 / o4-mini · Coming in v2' },
  gemini: { label: '✨ Gemini', detail: 'Gemini 2.5 Flash / Pro · Coming in v2' },
};

/**
 * Drives provider/model selection quick-picks and API key input boxes.
 * All changes write to VS Code workspace settings and trigger registry re-init
 * via onDidChangeConfiguration — no restart required.
 */
export class SettingsService {
  constructor(
    private readonly secretStore: ISecretStore,
    private readonly registry: ProviderRegistry,
  ) {}

  /**
   * Shows a quick-pick for selecting the active provider.
   * Displays readiness status for each provider (🟢 ready / 🔴 no key / 🌐 no key needed).
   */
  async selectProvider(): Promise<void> {
    const configuredProviders = await this.registry.listConfiguredProviders();
    const configuredSet = new Set(configuredProviders);

    const items = await Promise.all(
      ProviderFactory.SUPPORTED_PROVIDERS.map((name) => {
        const display = PROVIDER_DISPLAY[name];
        const isOllama = name === 'ollama';
        const isConfigured = isOllama || configuredSet.has(name);
        const isStub = name === 'openai' || name === 'gemini';

        let statusIcon = isConfigured ? '🟢' : '🔴';
        if (isOllama) statusIcon = '🌐';
        if (isStub) statusIcon = '⏳';

        return {
          label: `${statusIcon} ${display.label.replace(/^.+ /, '')}`,
          description: isStub
            ? 'Coming in v2'
            : isOllama
              ? 'No key needed'
              : isConfigured
                ? 'Ready'
                : 'Needs API key',
          detail: display.detail,
          value: name,
          picked: name === this.registry.getActiveProviderName(),
        };
      }),
    );

    const selected = await vscode.window.showQuickPick(items, {
      title: 'TokenFlow: Select AI Provider',
      placeHolder: 'Choose a provider',
    });

    if (!selected) return;

    const providerName = selected.value;

    // If provider needs a key and doesn't have one, prompt for it first
    if (providerName !== 'ollama' && !(await this.secretStore.hasApiKey(providerName))) {
      const keySet = await this.promptForApiKey(providerName);
      if (!keySet) return; // User cancelled key input
    }

    // Write to workspace settings — triggers onDidChangeConfiguration
    const config = vscode.workspace.getConfiguration('tokenflow');
    await config.update('provider', providerName, vscode.ConfigurationTarget.Global);

    // Also update the model to the provider's default unless user has set one
    const defaultModel = ModelCatalog.getDefaultModelId(providerName);
    await config.update('model', defaultModel, vscode.ConfigurationTarget.Global);

    void vscode.window.showInformationMessage(
      `✅ TokenFlow: Switched to ${providerName} / ${defaultModel}`,
    );
  }

  /**
   * Shows a quick-pick for selecting a model for the current provider.
   * Filtered to models for the active provider, sorted: free → default → alphabetical.
   */
  async selectModel(): Promise<void> {
    const provider = this.registry.getActiveProviderName();
    const models = ModelCatalog.getModelsForProvider(provider);

    if (models.length === 0) {
      void vscode.window.showWarningMessage(`No models found for provider "${provider}".`);
      return;
    }

    const config = vscode.workspace.getConfiguration('tokenflow');
    const currentModel = config.get<string>('model', '');

    const items = models.map((m) => ({
      label: `${m.isFree ? '🆓 ' : ''}${m.displayName}`,
      description: m.isDefault ? '(default)' : '',
      detail: `${m.contextWindow.toLocaleString()} ctx${m.capabilities.thinking ? ' · thinking' : ''}${m.capabilities.vision ? ' · vision' : ''}`,
      value: m.id,
      picked: m.id === currentModel,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      title: `TokenFlow: Select Model (${provider})`,
      placeHolder: 'Choose a model',
    });

    if (!selected) return;

    await config.update('model', selected.value, vscode.ConfigurationTarget.Global);

    void vscode.window.showInformationMessage(`✅ TokenFlow: Model set to ${selected.value}`);
  }

  /**
   * Prompts the user for an API key for the specified provider, stores it,
   * and re-initializes the registry.
   */
  async setApiKeyFor(
    provider: ProviderName = this.registry.getActiveProviderName(),
  ): Promise<void> {
    await this.promptForApiKey(provider);
    await this.registry.initialize();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async promptForApiKey(provider: ProviderName): Promise<boolean> {
    const hints: Record<ProviderName, string> = {
      openrouter: 'sk-or-... (get free key at openrouter.ai)',
      anthropic: 'sk-ant-... (console.anthropic.com)',
      ollama: 'No key needed',
      openai: 'sk-... (platform.openai.com)',
      gemini: 'AIza... (aistudio.google.com)',
    };

    const key = await vscode.window.showInputBox({
      title: `TokenFlow: Set ${provider} API Key`,
      prompt: `Enter your ${provider} API key. Stored securely in VS Code Secret Storage.`,
      password: true,
      placeHolder: hints[provider],
      validateInput: (value) => {
        if (!value || value.trim().length === 0) return 'API key cannot be empty.';
        return null;
      },
    });

    if (!key) return false;

    await this.secretStore.storeApiKey(provider, key.trim());
    void vscode.window.showInformationMessage(`✅ TokenFlow: API key saved for ${provider}.`);
    return true;
  }
}
