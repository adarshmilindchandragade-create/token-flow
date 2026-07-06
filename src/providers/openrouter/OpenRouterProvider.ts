// src/providers/openrouter/OpenRouterProvider.ts — OpenRouter provider (primary dev provider)
// Uses OpenAI-compatible API. Supports 400+ models including free tier.
// Default model: "openrouter/free" — OpenRouter auto-selects the best available free model.
// Falls back through ranked free models on 404 (model removed/changed).

import type { AIRequest, AIResponse, StreamChunkHandler } from '../../core/domain/AIRequest';
import type { ProviderCapabilities } from '../base/ProviderCapabilities';
import { BaseProvider } from '../base/BaseProvider';
import { ModelCatalog } from '../models/ModelCatalog';
import { TokenFlowError, TokenFlowErrorCode } from '../../shared/errors/TokenFlowError';
import { OpenRouterModelDiscovery } from './OpenRouterModelDiscovery';
import { Logger } from '../../shared/utils/logger';

/** OpenRouter /chat/completions response (subset). */
interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** OpenRouter streaming chunk (server-sent event data). */
interface OpenRouterStreamChunk {
  choices: Array<{
    delta: { content?: string };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** Error body from OpenRouter — used to detect recoverable 404s. */
interface OpenRouterErrorBody {
  error?: {
    message?: string;
    code?: number;
  };
}

export class OpenRouterProvider extends BaseProvider {
  static readonly BASE_URL = 'https://openrouter.ai/api/v1';

  /**
   * "openrouter/free" is OpenRouter's built-in free router.
   * It automatically selects an available free model and updates as the
   * free catalog changes — no hardcoded model slug needed.
   * See: https://openrouter.ai/openrouter/free
   */
  static readonly DEFAULT_MODEL = 'openrouter/free';

  private readonly logger = Logger.getInstance();
  readonly name = 'openrouter' as const;

  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    vision: false,
    thinking: false,
    tools: false,
    embeddings: false,
  };

  constructor(
    private readonly apiKey: string,
    readonly modelId: string = OpenRouterProvider.DEFAULT_MODEL,
  ) {
    super();
    // Update capabilities from ModelCatalog if the model is known
    const entry = ModelCatalog.getModel(modelId);
    if (entry) {
      (this as { capabilities: ProviderCapabilities }).capabilities = entry.capabilities;
    }
  }

  // ─── IProvider implementation ─────────────────────────────────────────────

  async send(request: AIRequest): Promise<AIResponse> {
    const start = Date.now();
    const model = request.model ?? this.modelId;
    return this.sendWithFallback(request, model, start, false, undefined);
  }

  async stream(request: AIRequest, onChunk: StreamChunkHandler): Promise<AIResponse> {
    const start = Date.now();
    const model = request.model ?? this.modelId;
    return this.sendWithFallback(request, model, start, true, onChunk);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${OpenRouterProvider.BASE_URL}/models`, {
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ─── Auto-fallback logic ──────────────────────────────────────────────────

  /**
   * Sends a request with automatic fallback on 404 (model removed / no longer free).
   * Strategy:
   *   1. Try requested model
   *   2. On 404 → discover free models via API → try each in ranked order
   *   3. If all fail → throw the original error
   */
  private async sendWithFallback(
    request: AIRequest,
    model: string,
    start: number,
    isStream: boolean,
    onChunk: StreamChunkHandler | undefined,
    attempt = 0,
    fallbackModels?: string[],
  ): Promise<AIResponse> {
    try {
      if (isStream && onChunk) {
        return await this.doStream(request, model, start, onChunk);
      }
      return await this.doSend(request, model, start);
    } catch (err) {
      if (this.isModelUnavailableError(err) && attempt < 3) {
        const models = fallbackModels ?? (await this.discoverFallbackModels(model));
        const next = models[attempt];

        if (next) {
          this.logger.warn(
            `[OpenRouter] Model ${model} unavailable (attempt ${attempt + 1}). Falling back to ${next}`,
          );
          return this.sendWithFallback(
            request,
            next,
            start,
            isStream,
            onChunk,
            attempt + 1,
            models,
          );
        }
      }
      throw err;
    }
  }

  private async discoverFallbackModels(excludeId: string): Promise<string[]> {
    try {
      const ranked = await OpenRouterModelDiscovery.getrankedFreeModels(this.apiKey);
      return ranked
        .map((m) => m.id)
        .filter((id) => id !== excludeId)
        .slice(0, 3); // top 3 alternatives
    } catch {
      // If discovery fails, try these reliable fallbacks in order
      return [
        'meta-llama/llama-3.1-8b-instruct:free',
        'mistralai/mistral-7b-instruct:free',
        'openrouter/free',
      ].filter((id) => id !== excludeId);
    }
  }

  private isModelUnavailableError(err: unknown): boolean {
    if (err instanceof TokenFlowError) {
      const msg = err.message.toLowerCase();
      return (
        msg.includes('404') ||
        msg.includes('not found') ||
        msg.includes('unavailable') ||
        msg.includes('no longer free')
      );
    }
    return false;
  }

  // ─── Core request methods ─────────────────────────────────────────────────

  private async doSend(request: AIRequest, model: string, start: number): Promise<AIResponse> {
    const res = await this.fetchJson<OpenRouterResponse>(
      `${OpenRouterProvider.BASE_URL}/chat/completions`,
      {
        method: 'POST',
        body: JSON.stringify({
          model,
          messages: this.buildMessages(request),
          max_tokens: request.maxTokens ?? 4096,
          temperature: request.temperature,
          stream: false,
        }),
      },
    );

    const content = res.choices[0]?.message.content ?? '';
    const usage = res.usage;
    const estimatedCostUsd = this.estimateCost(usage.prompt_tokens, usage.completion_tokens);

    return {
      content,
      model: res.model,
      usage: {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        estimatedCostUsd,
      },
      stopReason: res.choices[0]?.finish_reason ?? null,
      provider: this.name,
      latencyMs: Date.now() - start,
    };
  }

  private async doStream(
    request: AIRequest,
    model: string,
    start: number,
    onChunk: StreamChunkHandler,
  ): Promise<AIResponse> {
    const messages = this.buildMessages(request);
    const res = await this.fetchRaw(`${OpenRouterProvider.BASE_URL}/chat/completions`, {
      method: 'POST',
      body: JSON.stringify({
        model,
        messages,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature,
        stream: true,
      }),
    });

    let fullContent = '';
    let finalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    let stopReason: string | null = null;

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) {
          const text = decoder.decode(result.value as Uint8Array);
          const lines = text.split('\n').filter((l) => l.startsWith('data: '));
          for (const line of lines) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const chunk = JSON.parse(data) as OpenRouterStreamChunk;
              const delta = chunk.choices[0]?.delta.content ?? '';
              if (delta) {
                fullContent += delta;
                onChunk(delta);
              }
              if (chunk.choices[0]?.finish_reason) {
                stopReason = chunk.choices[0].finish_reason;
              }
              if (chunk.usage) {
                finalUsage = chunk.usage;
              }
            } catch {
              // Malformed chunk — skip
            }
          }
        }
      }
    }

    // OpenRouter may not return usage in streaming mode — approximate if needed
    if (finalUsage.total_tokens === 0) {
      finalUsage.prompt_tokens = await this.countTokens(messages.map((m) => m.content).join(' '));
      finalUsage.completion_tokens = await this.countTokens(fullContent);
      finalUsage.total_tokens = finalUsage.prompt_tokens + finalUsage.completion_tokens;
    }

    return {
      content: fullContent,
      model,
      usage: {
        inputTokens: finalUsage.prompt_tokens,
        outputTokens: finalUsage.completion_tokens,
        totalTokens: finalUsage.total_tokens,
        estimatedCostUsd: this.estimateCost(finalUsage.prompt_tokens, finalUsage.completion_tokens),
      },
      stopReason,
      provider: this.name,
      latencyMs: Date.now() - start,
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/tokenflow-ai/tokenflow-ai',
      'X-Title': 'TokenFlow AI',
    };
  }

  private async fetchRaw(url: string, options: RequestInit): Promise<Response> {
    const res = await fetch(url, {
      ...options,
      headers: { ...this.authHeaders(), ...((options.headers as Record<string, string>) ?? {}) },
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // Attempt to parse structured error for better fallback detection
      let parsed: OpenRouterErrorBody = {};
      try {
        parsed = JSON.parse(body) as OpenRouterErrorBody;
      } catch {
        /* ignore */
      }
      const message = parsed.error?.message ?? res.statusText;
      throw new TokenFlowError(
        `OpenRouter API error ${res.status}: ${message}. ${body}`,
        TokenFlowErrorCode.PROVIDER_API_ERROR,
      );
    }
    return res;
  }

  private async fetchJson<T>(url: string, options: RequestInit): Promise<T> {
    const res = await this.fetchRaw(url, options);
    return res.json() as Promise<T>;
  }
}
