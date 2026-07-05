// src/providers/ollama/OllamaProvider.ts — Ollama local inference provider
// Uses OpenAI-compatible API at http://localhost:11434/v1 (no API key required).
// Enables offline development with zero API cost.

import type { AIRequest, AIResponse, StreamChunkHandler } from '../../core/domain/AIRequest';
import type { ProviderCapabilities } from '../base/ProviderCapabilities';
import { BaseProvider } from '../base/BaseProvider';
import { ModelCatalog } from '../models/ModelCatalog';
import { TokenFlowError, TokenFlowErrorCode } from '../../shared/errors/TokenFlowError';

interface OllamaResponse {
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

interface OllamaStreamChunk {
  choices: Array<{
    delta: { content?: string };
    finish_reason: string | null;
  }>;
}

export class OllamaProvider extends BaseProvider {
  static readonly DEFAULT_MODEL = 'qwen2.5:latest';
  static readonly DEFAULT_BASE_URL = 'http://localhost:11434';

  readonly name = 'ollama' as const;

  readonly capabilities: ProviderCapabilities;

  constructor(
    readonly modelId: string = OllamaProvider.DEFAULT_MODEL,
    private readonly baseUrl: string = OllamaProvider.DEFAULT_BASE_URL,
  ) {
    super();
    this.capabilities = ModelCatalog.getModel(modelId)?.capabilities ?? {
      streaming: true,
      vision: false,
      thinking: false,
      tools: false,
      embeddings: false,
    };
  }

  private get apiBase(): string {
    return `${this.baseUrl}/v1`;
  }

  async send(request: AIRequest): Promise<AIResponse> {
    const start = Date.now();
    const model = request.model ?? this.modelId;

    const res = await this.fetchJson<OllamaResponse>(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      body: JSON.stringify({
        model,
        messages: this.buildMessages(request),
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature,
        stream: false,
      }),
    });

    const content = res.choices[0]?.message.content ?? '';

    return {
      content,
      model: res.model,
      usage: {
        inputTokens: res.usage.prompt_tokens,
        outputTokens: res.usage.completion_tokens,
        totalTokens: res.usage.total_tokens,
        estimatedCostUsd: 0, // Ollama is always free
      },
      stopReason: res.choices[0]?.finish_reason ?? null,
      provider: this.name,
      latencyMs: Date.now() - start,
    };
  }

  async stream(request: AIRequest, onChunk: StreamChunkHandler): Promise<AIResponse> {
    const start = Date.now();
    const model = request.model ?? this.modelId;

    const res = await this.fetchRaw(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      body: JSON.stringify({
        model,
        messages: this.buildMessages(request),
        max_tokens: request.maxTokens ?? 4096,
        stream: true,
      }),
    });

    let fullContent = '';
    let stopReason: string | null = null;
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) {
          const lines = decoder
            .decode(result.value as Uint8Array)
            .split('\n')
            .filter((l) => l.startsWith('data: '));
          for (const line of lines) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const chunk = JSON.parse(data) as OllamaStreamChunk;
              const delta = chunk.choices[0]?.delta.content ?? '';
              if (delta) {
                fullContent += delta;
                onChunk(delta);
              }
              if (chunk.choices[0]?.finish_reason) stopReason = chunk.choices[0].finish_reason;
            } catch {
              /* malformed chunk */
            }
          }
        }
      }
    }

    const inputTokens = await this.countTokens(request.messages.map((m) => m.content).join(' '));
    const outputTokens = await this.countTokens(fullContent);

    return {
      content: fullContent,
      model,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCostUsd: 0,
      },
      stopReason,
      provider: this.name,
      latencyMs: Date.now() - start,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Ollama's /api/tags endpoint lists installed models — cheap liveness check
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async fetchRaw(url: string, options: RequestInit): Promise<Response> {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new TokenFlowError(
        `Ollama API error ${res.status}: ${body || res.statusText}`,
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
