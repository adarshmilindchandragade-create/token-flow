// src/providers/gemini/GeminiProvider.ts — Google Gemini provider (v2 stub)
// Throws NOT_IMPLEMENTED. Wire when Gemini support is added via @google/generative-ai SDK.

import type { AIRequest, AIResponse, StreamChunkHandler } from '../../core/domain/AIRequest';
import type { ProviderCapabilities } from '../base/ProviderCapabilities';
import { BaseProvider } from '../base/BaseProvider';
import { TokenFlowError, TokenFlowErrorCode } from '../../shared/errors/TokenFlowError';

export class GeminiProvider extends BaseProvider {
  static readonly DEFAULT_MODEL = 'gemini-2.5-flash';

  readonly name = 'gemini' as const;

  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    vision: true,
    thinking: false,
    tools: true,
    embeddings: false,
  };

  constructor(
    _apiKey: string,
    readonly modelId: string = GeminiProvider.DEFAULT_MODEL,
  ) {
    super();
  }

  send(_request: AIRequest): Promise<AIResponse> {
    return Promise.reject(
      new TokenFlowError(
        'Gemini provider is not yet implemented. Switch to OpenRouter or Anthropic.',
        TokenFlowErrorCode.NOT_IMPLEMENTED,
      ),
    );
  }

  stream(_request: AIRequest, _onChunk: StreamChunkHandler): Promise<AIResponse> {
    return this.send(_request);
  }

  isAvailable(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
