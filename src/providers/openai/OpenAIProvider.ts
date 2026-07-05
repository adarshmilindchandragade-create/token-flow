// src/providers/openai/OpenAIProvider.ts — OpenAI provider (v2 stub)
// Throws NOT_IMPLEMENTED. Wire when OpenAI support is added.
// Model catalog entries are already present in openai.models.ts.

import type { AIRequest, AIResponse, StreamChunkHandler } from '../../core/domain/AIRequest';
import type { ProviderCapabilities } from '../base/ProviderCapabilities';
import { BaseProvider } from '../base/BaseProvider';
import { TokenFlowError, TokenFlowErrorCode } from '../../shared/errors/TokenFlowError';

export class OpenAIProvider extends BaseProvider {
  static readonly DEFAULT_MODEL = 'gpt-4o';

  readonly name = 'openai' as const;

  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    vision: true,
    thinking: false,
    tools: true,
    embeddings: false,
  };

  constructor(
    _apiKey: string,
    readonly modelId: string = OpenAIProvider.DEFAULT_MODEL,
  ) {
    super();
  }

  send(_request: AIRequest): Promise<AIResponse> {
    return Promise.reject(
      new TokenFlowError(
        'OpenAI provider is not yet implemented. Switch to OpenRouter or Anthropic.',
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
