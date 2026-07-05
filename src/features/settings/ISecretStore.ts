// src/features/settings/ISecretStore.ts — Abstract port for secret/key storage
// Allows future CLI, web, or test implementations without VS Code dependency.

/**
 * Port for storing API keys per provider.
 * Concrete implementations:
 *   - VSCodeSecretStore (production — encrypted OS credential store)
 *   - InMemorySecretStore (tests)
 *
 * All keys are namespaced internally — callers pass only the provider name.
 */
export interface ISecretStore {
  /**
   * Retrieves the API key for a named provider.
   * Returns `undefined` if no key has been stored.
   */
  getApiKey(provider: string): Promise<string | undefined>;

  /**
   * Stores an API key for a named provider.
   * Overwrites any existing key for that provider.
   */
  storeApiKey(provider: string, key: string): Promise<void>;

  /**
   * Deletes the API key for a named provider.
   * No-op if no key exists.
   */
  deleteApiKey(provider: string): Promise<void>;

  /**
   * Returns true if a non-empty key is stored for the given provider.
   */
  hasApiKey(provider: string): Promise<boolean>;
}

/**
 * In-memory implementation for use in unit tests and offline mode.
 * Keys are not persisted across restarts.
 */
export class InMemorySecretStore implements ISecretStore {
  private readonly store = new Map<string, string>();

  getApiKey(provider: string): Promise<string | undefined> {
    return Promise.resolve(this.store.get(provider));
  }

  storeApiKey(provider: string, key: string): Promise<void> {
    this.store.set(provider, key);
    return Promise.resolve();
  }

  deleteApiKey(provider: string): Promise<void> {
    this.store.delete(provider);
    return Promise.resolve();
  }

  hasApiKey(provider: string): Promise<boolean> {
    const key = this.store.get(provider);
    return Promise.resolve(typeof key === 'string' && key.length > 0);
  }
}
