// src/providers/models/ModelCatalog.ts — Aggregated model registry across all providers
// Aggregates per-provider model files. Query models by ID, provider, or capability.

import type { ProviderCapabilities } from '../base/ProviderCapabilities';
import type { ProviderName } from '../base/IProvider';
import { ANTHROPIC_MODELS } from './anthropic.models';
import { OPENROUTER_MODELS } from './openrouter.models';
import { OLLAMA_MODELS } from './ollama.models';
import { OPENAI_MODELS } from './openai.models';
import { GEMINI_MODELS } from './gemini.models';
import { PricingCatalog } from './PricingCatalog';

export type { ProviderName };

/**
 * A single model entry in the catalog.
 * Capabilities are stable metadata. Pricing lives in PricingCatalog.
 */
export interface ModelEntry {
  /** Provider-internal model identifier. */
  id: string;
  /** Human-readable display name shown in quick-picks. */
  displayName: string;
  /** Provider that hosts this model. */
  provider: ProviderName;
  /** Maximum combined input+output token budget. */
  contextWindow: number;
  /** Structured capability record for this model. */
  capabilities: ProviderCapabilities;
  /** True for models with $0 input/output cost. */
  isFree: boolean;
  /** Marks this as the recommended default for its provider. */
  isDefault?: boolean;
  /** Marks retired models that should not be selected in new projects. */
  isDeprecated?: boolean;
}

/** All models across all providers, aggregated from per-provider files. */
const ALL_MODELS: ModelEntry[] = [
  ...OPENROUTER_MODELS,
  ...ANTHROPIC_MODELS,
  ...OLLAMA_MODELS,
  ...OPENAI_MODELS,
  ...GEMINI_MODELS,
];

/**
 * Central model registry.
 * Pure static class — no VS Code dependencies.
 */
export class ModelCatalog {
  private static readonly byId = new Map<string, ModelEntry>(ALL_MODELS.map((m) => [m.id, m]));

  /**
   * Returns the ModelEntry for a given model ID.
   * Returns `undefined` for unknown IDs (e.g., user-typed custom models).
   */
  static getModel(modelId: string): ModelEntry | undefined {
    return ModelCatalog.byId.get(modelId);
  }

  /**
   * Returns all models for a given provider, sorted by: free first, then alphabetical.
   */
  static getModelsForProvider(provider: ProviderName): ModelEntry[] {
    return ALL_MODELS.filter((m) => m.provider === provider && !m.isDeprecated).sort((a, b) => {
      if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }

  /**
   * Returns the default model ID for a provider.
   * Falls back to the first non-deprecated model if no isDefault is flagged.
   */
  static getDefaultModelId(provider: ProviderName): string {
    const models = ModelCatalog.getModelsForProvider(provider);
    return models.find((m) => m.isDefault)?.id ?? models[0]?.id ?? '';
  }

  /**
   * Returns all free models across all providers.
   */
  static getFreeModels(): ModelEntry[] {
    return ALL_MODELS.filter((m) => m.isFree && !m.isDeprecated);
  }

  /**
   * Returns all models that support a given capability.
   */
  static getByCapability(capability: keyof ProviderCapabilities): ModelEntry[] {
    return ALL_MODELS.filter((m) => m.capabilities[capability] && !m.isDeprecated);
  }

  /**
   * Estimates the USD cost for a request to the given model.
   * Delegates to PricingCatalog — model metadata and pricing are independent.
   */
  static estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    return PricingCatalog.estimateCost(modelId, inputTokens, outputTokens);
  }

  /**
   * Returns input/output cost per M tokens for a model.
   * Returns {0, 0} for free models and a conservative fallback for unknown models.
   */
  static getPricing(modelId: string): { inputCostPerMToken: number; outputCostPerMToken: number } {
    const entry = PricingCatalog.forModel(modelId);
    return {
      inputCostPerMToken: entry.inputCostPerMToken,
      outputCostPerMToken: entry.outputCostPerMToken,
    };
  }

  /** Returns the total number of models in the catalog. */
  static count(): number {
    return ALL_MODELS.length;
  }

  /** Returns all models. For display in settings UIs. */
  static getAll(): ModelEntry[] {
    return [...ALL_MODELS];
  }
}
