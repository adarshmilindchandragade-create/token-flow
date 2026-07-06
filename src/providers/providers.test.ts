// src/providers/providers.test.ts — Unit tests for the provider layer
// Tests ModelCatalog, PricingCatalog, ProviderFactory (raw), and middleware pipeline.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelCatalog } from './models/ModelCatalog';
import { PricingCatalog } from './models/PricingCatalog';
import { ProviderFactory } from './factory/ProviderFactory';
import { InMemorySecretStore } from '../features/settings/ISecretStore';
import { RetryMiddleware } from './middleware/RetryMiddleware';
import { TokenFlowErrorCode, TokenFlowError } from '../shared/errors/TokenFlowError';
import type { AIRequest, AIResponse } from '../core/domain/AIRequest';

// ─── ModelCatalog ─────────────────────────────────────────────────────────────

describe('ModelCatalog', () => {
  it('returns the correct entry for a known model', () => {
    const entry = ModelCatalog.getModel('meta-llama/llama-3.1-8b-instruct:free');
    expect(entry).toBeDefined();
    expect(entry!.isFree).toBe(true);
    expect(entry!.provider).toBe('openrouter');
  });

  it('returns undefined for an unknown model', () => {
    expect(ModelCatalog.getModel('unknown/model-xyz')).toBeUndefined();
  });

  it('returns the default Anthropic model as claude-3-5-sonnet', () => {
    const defaultId = ModelCatalog.getDefaultModelId('anthropic');
    expect(defaultId).toBe('claude-3-5-sonnet-20241022');
  });

  it('returns the default OpenRouter model as openrouter/free (auto-router)', () => {
    const defaultId = ModelCatalog.getDefaultModelId('openrouter');
    expect(defaultId).toBe('openrouter/free');
  });

  it('returns free models only for getFreeModels()', () => {
    const free = ModelCatalog.getFreeModels();
    expect(free.length).toBeGreaterThan(0);
    free.forEach((m) => expect(m.isFree).toBe(true));
  });

  it('finds thinking-capable models', () => {
    const thinkers = ModelCatalog.getByCapability('thinking');
    expect(thinkers.length).toBeGreaterThan(0);
    expect(thinkers.some((m) => m.id === 'claude-3-7-sonnet-20250219')).toBe(true);
  });

  it('correctly reports claude-3-5-sonnet has no thinking capability', () => {
    const entry = ModelCatalog.getModel('claude-3-5-sonnet-20241022');
    expect(entry?.capabilities.thinking).toBe(false);
  });

  it('correctly reports claude-3-7-sonnet supports thinking', () => {
    const entry = ModelCatalog.getModel('claude-3-7-sonnet-20250219');
    expect(entry?.capabilities.thinking).toBe(true);
  });

  it('returns models for provider sorted with free first', () => {
    const orModels = ModelCatalog.getModelsForProvider('openrouter');
    const firstFreeIdx = orModels.findIndex((m) => m.isFree);
    const firstPaidIdx = orModels.findIndex((m) => !m.isFree);
    expect(firstFreeIdx).toBeLessThan(firstPaidIdx);
  });

  it('count() returns a positive number', () => {
    expect(ModelCatalog.count()).toBeGreaterThan(10);
  });
});

// ─── PricingCatalog ───────────────────────────────────────────────────────────

describe('PricingCatalog', () => {
  it('returns zero cost for free models', () => {
    const pricing = PricingCatalog.forModel('google/gemma-3-12b-it:free');
    expect(pricing.inputCostPerMToken).toBe(0);
    expect(pricing.outputCostPerMToken).toBe(0);
  });

  it('returns correct pricing for claude-3-5-sonnet', () => {
    const pricing = PricingCatalog.forModel('claude-3-5-sonnet-20241022');
    expect(pricing.inputCostPerMToken).toBe(3.0);
    expect(pricing.outputCostPerMToken).toBe(15.0);
  });

  it('estimateCost returns 0 for free models', () => {
    const cost = PricingCatalog.estimateCost('google/gemma-3-12b-it:free', 10_000, 500);
    expect(cost).toBe(0);
  });

  it('estimateCost calculates correctly for paid models', () => {
    // claude-3-5-sonnet: $3/M in, $15/M out
    // 1000 input = 0.003, 100 output = 0.0015 → total = 0.0045
    const cost = PricingCatalog.estimateCost('claude-3-5-sonnet-20241022', 1_000, 100);
    expect(cost).toBeCloseTo(0.0045, 6);
  });

  it('returns UNKNOWN_PRICING for unrecognized model (not zero)', () => {
    const pricing = PricingCatalog.forModel('totally/unknown-model');
    expect(pricing.inputCostPerMToken).toBeGreaterThan(0);
  });
});

// ─── ProviderFactory ──────────────────────────────────────────────────────────

describe('ProviderFactory', () => {
  let secretStore: InMemorySecretStore;

  beforeEach(() => {
    secretStore = new InMemorySecretStore();
  });

  it('throws PROVIDER_NOT_CONFIGURED when openrouter key is missing', async () => {
    await expect(
      ProviderFactory.createRaw(
        { name: 'openrouter', modelId: 'google/gemma-3-12b-it:free' },
        secretStore,
      ),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof TokenFlowError && err.code === TokenFlowErrorCode.PROVIDER_NOT_CONFIGURED,
    );
  });

  it('throws PROVIDER_NOT_CONFIGURED when anthropic key is missing', async () => {
    await expect(
      ProviderFactory.createRaw(
        { name: 'anthropic', modelId: 'claude-3-5-sonnet-20241022' },
        secretStore,
      ),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof TokenFlowError && err.code === TokenFlowErrorCode.PROVIDER_NOT_CONFIGURED,
    );
  });

  it('creates OllamaProvider without a key (no key required)', async () => {
    const provider = await ProviderFactory.createRaw(
      { name: 'ollama', modelId: 'qwen2.5:latest' },
      secretStore,
    );
    expect(provider.name).toBe('ollama');
    expect(provider.modelId).toBe('qwen2.5:latest');
  });

  it('creates OpenRouterProvider when key is present', async () => {
    await secretStore.storeApiKey('openrouter', 'sk-or-test-key');
    const provider = await ProviderFactory.createRaw(
      { name: 'openrouter', modelId: 'google/gemma-3-12b-it:free' },
      secretStore,
    );
    expect(provider.name).toBe('openrouter');
  });

  it('creates OpenAI stub that throws NOT_IMPLEMENTED on send()', async () => {
    await secretStore.storeApiKey('openai', 'sk-test-openai');
    const provider = await ProviderFactory.createRaw(
      { name: 'openai', modelId: 'gpt-4o' },
      secretStore,
    );
    const req: AIRequest = { messages: [{ role: 'user', content: 'test' }] };
    await expect(provider.send(req)).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof TokenFlowError && err.code === TokenFlowErrorCode.NOT_IMPLEMENTED,
    );
  });

  it('creates Gemini stub that throws NOT_IMPLEMENTED on send()', async () => {
    await secretStore.storeApiKey('gemini', 'AIza-test-key');
    const provider = await ProviderFactory.createRaw(
      { name: 'gemini', modelId: 'gemini-2.5-flash' },
      secretStore,
    );
    const req: AIRequest = { messages: [{ role: 'user', content: 'test' }] };
    await expect(provider.send(req)).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof TokenFlowError && err.code === TokenFlowErrorCode.NOT_IMPLEMENTED,
    );
  });

  it('lists all supported providers', () => {
    expect(ProviderFactory.SUPPORTED_PROVIDERS).toEqual([
      'openrouter',
      'anthropic',
      'ollama',
      'openai',
      'gemini',
    ]);
  });
});

// ─── RetryMiddleware ──────────────────────────────────────────────────────────

describe('RetryMiddleware', () => {
  it('retries up to maxRetries on API errors', async () => {
    const mockResponse: AIResponse = {
      content: 'ok',
      model: 'test',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, estimatedCostUsd: 0 },
      stopReason: 'end_turn',
      provider: 'test',
      latencyMs: 50,
    };

    let attempts = 0;
    const fakeProvider = {
      name: 'openrouter' as const,
      modelId: 'test-model',
      capabilities: {
        streaming: false,
        vision: false,
        thinking: false,
        tools: false,
        embeddings: false,
      },
      connect: vi.fn(),
      isAvailable: vi.fn().mockResolvedValue(true),
      stream: vi.fn(),
      countTokens: vi.fn(),
      send: vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) throw new Error('Network error');
        return mockResponse;
      }),
    };

    const middleware = new RetryMiddleware(fakeProvider, 3, 0); // 0ms delay for tests
    const req: AIRequest = { messages: [{ role: 'user', content: 'hi' }] };
    const result = await middleware.send(req);

    expect(result.content).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('does not retry NOT_IMPLEMENTED errors', async () => {
    let callCount = 0;
    const fakeProvider = {
      name: 'openai' as const,
      modelId: 'gpt-4o',
      capabilities: {
        streaming: false,
        vision: false,
        thinking: false,
        tools: false,
        embeddings: false,
      },
      connect: vi.fn(),
      isAvailable: vi.fn(),
      stream: vi.fn(),
      countTokens: vi.fn(),
      send: vi.fn().mockImplementation(() => {
        callCount++;
        throw new TokenFlowError('not implemented', TokenFlowErrorCode.NOT_IMPLEMENTED);
      }),
    };

    const middleware = new RetryMiddleware(fakeProvider, 3, 0);
    const req: AIRequest = { messages: [{ role: 'user', content: 'hi' }] };

    await expect(middleware.send(req)).rejects.toBeInstanceOf(TokenFlowError);
    expect(callCount).toBe(1); // No retries
  });
});
