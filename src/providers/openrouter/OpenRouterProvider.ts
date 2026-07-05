// src/providers/openrouter/OpenRouterProvider.ts — OpenRouter provider (primary dev provider)
// Uses OpenAI-compatible API. Supports 50+ models including free tier.
// No additional SDK needed — uses native fetch with Authorization + HTTP-Referer headers.

import type { AIRequest, AIResponse, StreamChunkHandler } from '../../core/domain/AIRequest';
import type { ProviderCapabilities } from '../base/ProviderCapabilities';
import { BaseProvider } from '../base/BaseProvider';
import { ModelCatalog } from '../models/ModelCatalog';
import { TokenFlowError, TokenFlowErrorCode } from '../../shared/errors/TokenFlowError';

/** OpenAI-compatible message format used by the OpenRouter API. */
interface OpenRouterMessage {
  role: string;
  content: string;
}

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

export class OpenRouterProvider extends BaseProvider {
  static readonly BASE_URL = 'https://openrouter.ai/api/v1';
  static readonly DEFAULT_MODEL = 'google/gemma-3-12b-it:free';

  readonly name = 'openrouter' as const;

  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    vision: false, // depends on model — override per-request if needed
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

    const res = await this.fetchJson<OpenRouterResponse>(
      `${OpenRouterProvider.BASE_URL}/chat/completions`,
      {
        method: 'POST',
        body: JSON.stringify({
          model,
          messages: this.buildOpenRouterMessages(request),
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

  async stream(request: AIRequest, onChunk: StreamChunkHandler): Promise<AIResponse> {
    const start = Date.now();
    const messages = this.buildOpenRouterMessages(request);
    const model = request.model ?? this.modelId;

    const res = await this.fetchRaw(
      `${OpenRouterProvider.BASE_URL}/chat/completions`,
      {
        method: 'POST',
        body: JSON.stringify({
          model,
          messages: this.buildOpenRouterMessages(request),
          max_tokens: request.maxTokens ?? 4096,
          temperature: request.temperature,
          stream: true,
        }),
      },
    );

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

  // ─── Private helpers ──────────────────────────────────────────────────────

  private authHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/tokenflow-ai/tokenflow-ai',
      'X-Title': 'TokenFlow AI',
    };
  }

  private buildOpenRouterMessages(request: AIRequest): OpenRouterMessage[] {
    const messages: OpenRouterMessage[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    for (const msg of request.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }
    return messages;
  }

  private async fetchRaw(url: string, options: RequestInit): Promise<Response> {
    const res = await fetch(url, {
      ...options,
      headers: { ...this.authHeaders(), ...(options.headers as Record<string, string> ?? {}) },
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new TokenFlowError(
        `OpenRouter API error ${res.status}: ${res.statusText}. ${body}`,
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
