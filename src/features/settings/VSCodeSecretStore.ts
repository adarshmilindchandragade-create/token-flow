// src/features/settings/VSCodeSecretStore.ts — VS Code SecretStorage implementation of ISecretStore
// Production implementation: keys are encrypted by the OS credential store.

import type * as vscode from 'vscode';
import type { ISecretStore } from './ISecretStore';
import { SECRET_KEY_PREFIX } from '../../shared/constants';

/**
 * Implements ISecretStore using VS Code's encrypted SecretStorage API.
 * Keys are namespaced as `tokenflow.apiKey.<provider>`.
 *
 * For tests or non-VS Code environments, use InMemorySecretStore from ISecretStore.ts.
 */
export class VSCodeSecretStore implements ISecretStore {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  private keyFor(provider: string): string {
    return `${SECRET_KEY_PREFIX}.${provider}`;
  }

  async getApiKey(provider: string): Promise<string | undefined> {
    return this.secrets.get(this.keyFor(provider));
  }

  async storeApiKey(provider: string, key: string): Promise<void> {
    await this.secrets.store(this.keyFor(provider), key);
  }

  async deleteApiKey(provider: string): Promise<void> {
    await this.secrets.delete(this.keyFor(provider));
  }

  async hasApiKey(provider: string): Promise<boolean> {
    const key = await this.secrets.get(this.keyFor(provider));
    return typeof key === 'string' && key.length > 0;
  }
}
