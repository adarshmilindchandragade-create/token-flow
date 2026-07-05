// src/core/domain/AIRequest.ts — Canonical AI request/response types
// All providers accept AIRequest and return AIResponse.
// The extension layer never depends on provider-specific payload formats.

/**
 * A single message in an AI conversation.
 * Used by every provider adapter — maps to provider-specific wire formats internally.
 */
export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Canonical request payload — the extension always constructs this type,
 * never a provider-specific format.
 */
export interface AIRequest {
  /** Conversation history + current user turn. */
  messages: AIMessage[];
  /** System-level context (project info, optimized workspace context). */
  systemPrompt?: string;
  /** Max completion tokens. Providers use their own defaults if omitted. */
  maxTokens?: number;
  /** Override the provider's active model for this specific request. */
  model?: string;
  /** Sampling temperature (0–1). Providers use defaults if omitted. */
  temperature?: number;
  /** Hint that streaming is preferred. Providers may ignore if unsupported. */
  preferStream?: boolean;
}

/**
 * Token usage data attached to every AI response.
 * Populated from the provider's API response (not estimated locally).
 */
export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Estimated USD cost calculated from the provider's pricing catalog. */
  estimatedCostUsd: number;
}

/**
 * Canonical response — every provider adapter returns this type.
 * Contains provenance data (latency, provider name) for the event bus.
 */
export interface AIResponse {
  /** Generated text (concatenated if the provider returns multiple blocks). */
  content: string;
  /** Model identifier as reported by the provider. */
  model: string;
  /** Token usage from the API response. */
  usage: AIUsage;
  /** Stop reason (e.g., 'end_turn', 'max_tokens', 'stop'). Null if unavailable. */
  stopReason: string | null;
  /** Provider name that served this response. */
  provider: string;
  /** End-to-end request latency in milliseconds. */
  latencyMs: number;
}

/**
 * Streaming chunk handler — called progressively as tokens arrive.
 * `content` is the incremental text (not cumulative).
 */
export type StreamChunkHandler = (chunk: string) => void;

// ─── Backward-compatibility aliases ──────────────────────────────────────────
// Code that imports ProviderMessage/ProviderRequest/ProviderResponse from
// the old IProvider.ts still compiles. Prefer AIMessage/AIRequest/AIResponse
// for all new code.
export type ProviderMessage = AIMessage;
export type ProviderRequest = AIRequest;
export type ProviderResponse = Omit<AIResponse, 'provider' | 'latencyMs'>;
