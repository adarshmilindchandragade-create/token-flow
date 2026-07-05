// src/providers/base/ProviderCapabilities.ts — Structured capability types for AI providers

/**
 * Declares what an AI provider or model can do.
 * Replaces scattered boolean methods on IProvider with a single typed record.
 *
 * Usage:
 *   if (provider.capabilities.streaming) { ... }
 *   if (model.capabilities.thinking)     { ... }
 */
export interface ProviderCapabilities {
  /** Provider supports streaming responses (token-by-token delivery). */
  readonly streaming: boolean;
  /** Provider can process image inputs alongside text. */
  readonly vision: boolean;
  /**
   * Provider supports extended thinking / chain-of-thought reasoning.
   * Currently: claude-3-7-sonnet only.
   */
  readonly thinking: boolean;
  /** Provider supports tool / function calling. */
  readonly tools: boolean;
  /** Provider can generate text embeddings. */
  readonly embeddings: boolean;
}

/**
 * Zero-capability sentinel — use as the default in stubs and fallbacks.
 */
export const NO_CAPABILITIES: ProviderCapabilities = {
  streaming: false,
  vision: false,
  thinking: false,
  tools: false,
  embeddings: false,
} as const;

/**
 * Represents the live health of a provider connection.
 * Returned by `IProvider.connect()` and surfaced in diagnostics.
 */
export interface ProviderHealth {
  /** TCP/network reachability to the provider endpoint. */
  connected: boolean;
  /** API key is present and accepted. */
  authenticated: boolean;
  /** The selected model is available on the provider. */
  modelAvailable: boolean;
  /** Round-trip latency for the health check (ms). */
  latencyMs?: number;
  /** Provider API version string, if reported. */
  version?: string;
  /** ISO timestamp of when this health check was run. */
  lastCheckedAt: Date;
  /** Human-readable error string when any flag above is false. */
  error?: string;
}

/**
 * Sentinel ProviderHealth representing a completely unavailable provider.
 * Use as the default before a connection attempt.
 */
export const UNHEALTHY_PROVIDER: ProviderHealth = {
  connected: false,
  authenticated: false,
  modelAvailable: false,
  lastCheckedAt: new Date(0),
  error: 'Provider not yet connected.',
} as const;
