// src/features/storage/secretStorage.ts — VS Code SecretStorage wrapper for API keys

import type * as vscode from 'vscode';
import { SECRET_KEY_PREFIX } from '../../shared/constants';
import { TokenFlowError, TokenFlowErrorCode } from '../../shared/errors/TokenFlowError';

/**
 * Wraps VS Code's encrypted SecretStorage API for safe API key management.
 *
 * Keys are stored under: `tokenflow.apiKey.<providerName>`
 * They are encrypted by VS Code using the OS credential store —
 * never visible in settings.json, never transmitted, never logged.
 *
 * Security: API keys must never appear in Logger output, error messages,
 * or any user-facing text. This class is the only place that handles raw keys.
 */
export class SecretStorageService {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  /**
   * Stores an API key for a named provider.
   * Overwrites any existing key for that provider.
   *
   * @throws {TokenFlowError} with STORAGE_ERROR if the write fails.
   */
  async storeApiKey(provider: string, key: string): Promise<void> {
    try {
      await this.secrets.store(this.keyFor(provider), key);
    } catch (err) {
      throw new TokenFlowError(
        `Failed to store API key for ${provider}.`,
        TokenFlowErrorCode.STORAGE_ERROR,
        err instanceof Error ? err : undefined,
      );
    }
  }

  /**
   * Retrieves the API key for a named provider.
   * Returns `undefined` if no key has been stored — callers should prompt the user.
   */
  async getApiKey(provider: string): Promise<string | undefined> {
    return this.secrets.get(this.keyFor(provider));
  }

  /**
   * Deletes the stored API key for a named provider.
   * No-op if no key exists.
   */
  async deleteApiKey(provider: string): Promise<void> {
    await this.secrets.delete(this.keyFor(provider));
  }

  /** Returns true if a non-empty key is stored for the given provider. */
  async hasApiKey(provider: string): Promise<boolean> {
    const key = await this.getApiKey(provider);
    return typeof key === 'string' && key.length > 0;
  }

  private keyFor(provider: string): string {
    return `${SECRET_KEY_PREFIX}.${provider}`;
  }
}
