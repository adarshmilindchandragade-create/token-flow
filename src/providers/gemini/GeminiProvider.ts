// src/providers/gemini/GeminiProvider.ts — Google Gemini provider (AI Studio)
// Uses the official @google/genai SDK.
// Free tier: generous quotas via AI Studio API key (no billing required).
// Models: gemini-2.5-flash (default, fast), gemini-2.5-pro (reasoning, long-context)

import { GoogleGenAI } from '@google/genai';
import type { AIRequest, AIResponse, StreamChunkHandler } from '../../core/domain/AIRequest';
import type { ProviderCapabilities } from '../base/ProviderCapabilities';
import { BaseProvider } from '../base/BaseProvider';
import { TokenFlowError, TokenFlowErrorCode } from '../../shared/errors/TokenFlowError';

export class GeminiProvider extends BaseProvider {
  static readonly DEFAULT_MODEL = 'gemini-2.5-flash';

  private readonly client: GoogleGenAI;
  readonly name = 'gemini' as const;

  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    vision: true,
    thinking: true,
    tools: true,
    embeddings: false,
  };

  constructor(
    readonly apiKey: string,
    readonly modelId: string = GeminiProvider.DEFAULT_MODEL,
  ) {
    super();
    this.client = new GoogleGenAI({ apiKey });
  }

  // ─── IProvider ─────────────────────────────────────────────────────────────

  async send(request: AIRequest): Promise<AIResponse> {
    const start = Date.now();
    try {
      const prompt = this.buildPrompt(request);
      const response = await this.client.models.generateContent({
        model: this.modelId,
        contents: prompt,
      });

      const content = response.text ?? '';
      const usage = response.usageMetadata;
      const inputTokens = usage?.promptTokenCount ?? 0;
      const outputTokens = usage?.candidatesTokenCount ?? 0;

      return {
        content,
        model: this.modelId,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          estimatedCostUsd: this.estimateCost(inputTokens, outputTokens),
        },
        stopReason: response.candidates?.[0]?.finishReason ?? null,
        provider: this.name,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async stream(request: AIRequest, onChunk: StreamChunkHandler): Promise<AIResponse> {
    const start = Date.now();
    try {
      const prompt = this.buildPrompt(request);
      const streamResult = await this.client.models.generateContentStream({
        model: this.modelId,
        contents: prompt,
      });

      let fullContent = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let stopReason: string | null = null;

      for await (const chunk of streamResult) {
        const delta = chunk.text ?? '';
        if (delta) {
          fullContent += delta;
          onChunk(delta);
        }
        if (chunk.usageMetadata) {
          inputTokens = chunk.usageMetadata.promptTokenCount ?? inputTokens;
          outputTokens = chunk.usageMetadata.candidatesTokenCount ?? outputTokens;
        }
        const finishReason = chunk.candidates?.[0]?.finishReason;
        if (finishReason) stopReason = finishReason;
      }

      // Fallback token count if SDK didn't return usage
      if (inputTokens === 0) {
        inputTokens = await this.countTokens(this.buildPromptText(request));
        outputTokens = await this.countTokens(fullContent);
      }

      return {
        content: fullContent,
        model: this.modelId,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          estimatedCostUsd: this.estimateCost(inputTokens, outputTokens),
        },
        stopReason,
        provider: this.name,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Lightweight check: list models (very fast, no generation cost)
      await this.client.models.get({ model: this.modelId });
      return true;
    } catch {
      return false;
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private buildPrompt(request: AIRequest): string {
    return this.buildPromptText(request);
  }

  private buildPromptText(request: AIRequest): string {
    const parts: string[] = [];
    if (request.systemPrompt) {
      parts.push(`System: ${request.systemPrompt}`);
    }
    for (const msg of request.messages) {
      parts.push(`${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`);
    }
    return parts.join('\n\n');
  }

  private wrapError(err: unknown): TokenFlowError {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();

    if (lower.includes('api_key') || lower.includes('unauthorized') || lower.includes('401')) {
      return new TokenFlowError(
        `Gemini: Invalid API key. Get a free key at aistudio.google.com/apikey. ${msg}`,
        TokenFlowErrorCode.PROVIDER_API_ERROR,
      );
    }
    if (lower.includes('quota') || lower.includes('429') || lower.includes('resource_exhausted')) {
      return new TokenFlowError(
        `Gemini: Quota exceeded (429). TokenFlow will fall back to next provider. ${msg}`,
        TokenFlowErrorCode.PROVIDER_API_ERROR,
      );
    }
    if (lower.includes('not found') || lower.includes('404')) {
      return new TokenFlowError(
        `Gemini: Model not found — "${this.modelId}". Check model ID. ${msg}`,
        TokenFlowErrorCode.PROVIDER_API_ERROR,
      );
    }
    return new TokenFlowError(`Gemini API error: ${msg}`, TokenFlowErrorCode.PROVIDER_API_ERROR);
  }
}
