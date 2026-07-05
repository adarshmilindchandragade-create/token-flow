// src/providers/models/PricingCatalog.ts — Per-model pricing data
// Separated from model metadata because prices change frequently.
// ModelCatalog entries describe capabilities; PricingCatalog describes cost.
//
// All prices are in USD per 1,000,000 tokens.
// Last verified: 2026-07-02

export interface PricingEntry {
  /** Matches ModelEntry.id */
  modelId: string;
  /** USD per 1M input (prompt) tokens */
  inputCostPerMToken: number;
  /** USD per 1M output (completion) tokens */
  outputCostPerMToken: number;
  /** ISO date the pricing was last verified against provider docs */
  verifiedAt: string;
}

/**
 * Central pricing table.
 * Free models have 0/0 pricing.
 * Unrecognized models fall back to UNKNOWN_PRICING.
 */
const PRICING_TABLE: PricingEntry[] = [
  // ─── Anthropic ─────────────────────────────────────────────────────────────
  {
    modelId: 'claude-3-5-sonnet-20241022',
    inputCostPerMToken: 3.0,
    outputCostPerMToken: 15.0,
    verifiedAt: '2026-07-02',
  },
  {
    modelId: 'claude-3-5-haiku-20241022',
    inputCostPerMToken: 0.8,
    outputCostPerMToken: 4.0,
    verifiedAt: '2026-07-02',
  },
  {
    modelId: 'claude-3-opus-20240229',
    inputCostPerMToken: 15.0,
    outputCostPerMToken: 75.0,
    verifiedAt: '2026-07-02',
  },
  {
    modelId: 'claude-3-7-sonnet-20250219',
    inputCostPerMToken: 3.0,
    outputCostPerMToken: 15.0,
    verifiedAt: '2026-07-02',
  },
  {
    modelId: 'claude-3-haiku-20240307',
    inputCostPerMToken: 0.25,
    outputCostPerMToken: 1.25,
    verifiedAt: '2026-07-02',
  },
  // ─── OpenRouter Free Models ────────────────────────────────────────────────
  {
    modelId: 'google/gemma-3-12b-it:free',
    inputCostPerMToken: 0,
    outputCostPerMToken: 0,
    verifiedAt: '2026-07-02',
  },
  {
    modelId: 'qwen/qwen3-8b:free',
    inputCostPerMToken: 0,
    outputCostPerMToken: 0,
    verifiedAt: '2026-07-02',
  },
  {
    modelId: 'deepseek/deepseek-r1:free',
    inputCostPerMToken: 0,
    outputCostPerMToken: 0,
    verifiedAt: '2026-07-02',
  },
  {
    modelId: 'meta-llama/llama-3.1-8b-instruct:free',
    inputCostPerMToken: 0,
    outputCostPerMToken: 0,
    verifiedAt: '2026-07-02',
  },
  {
    modelId: 'mistralai/mistral-7b-instruct:free',
    inputCostPerMToken: 0,
    outputCostPerMToken: 0,
    verifiedAt: '2026-07-02',
  },
  // ─── OpenRouter Paid Models ────────────────────────────────────────────────
  {
    modelId: 'anthropic/claude-3.5-sonnet',
    inputCostPerMToken: 3.0,
    outputCostPerMToken: 15.0,
    verifiedAt: '2026-07-02',
  },
  {
    modelId: 'openai/gpt-4o',
    inputCostPerMToken: 2.5,
    outputCostPerMToken: 10.0,
    verifiedAt: '2026-07-02',
  },
  {
    modelId: 'qwen/qwen3-235b-a22b',
    inputCostPerMToken: 0.14,
    outputCostPerMToken: 0.6,
    verifiedAt: '2026-07-02',
  },
  // ─── Ollama (local — zero cost) ────────────────────────────────────────────
  // All Ollama models are free — pattern-matched in PricingCatalog.forModel()
  // ─── OpenAI ────────────────────────────────────────────────────────────────
  {
    modelId: 'gpt-4o',
    inputCostPerMToken: 2.5,
    outputCostPerMToken: 10.0,
    verifiedAt: '2026-07-02',
  },
  {
    modelId: 'gpt-4.1',
    inputCostPerMToken: 2.0,
    outputCostPerMToken: 8.0,
    verifiedAt: '2026-07-02',
  },
  {
    modelId: 'o3-mini',
    inputCostPerMToken: 1.1,
    outputCostPerMToken: 4.4,
    verifiedAt: '2026-07-02',
  },
  {
    modelId: 'o4-mini',
    inputCostPerMToken: 1.1,
    outputCostPerMToken: 4.4,
    verifiedAt: '2026-07-02',
  },
  // ─── Gemini ────────────────────────────────────────────────────────────────
  {
    modelId: 'gemini-2.5-flash',
    inputCostPerMToken: 0.15,
    outputCostPerMToken: 0.6,
    verifiedAt: '2026-07-02',
  },
  {
    modelId: 'gemini-2.5-pro',
    inputCostPerMToken: 1.25,
    outputCostPerMToken: 10.0,
    verifiedAt: '2026-07-02',
  },
];

/** Fallback pricing for models not in the catalog — conservative estimate. */
export const UNKNOWN_PRICING: PricingEntry = {
  modelId: '__unknown__',
  inputCostPerMToken: 1.0,
  outputCostPerMToken: 4.0,
  verifiedAt: '2026-07-02',
};

/** Zero-cost pricing for free/local models. */
export const FREE_PRICING: PricingEntry = {
  modelId: '__free__',
  inputCostPerMToken: 0,
  outputCostPerMToken: 0,
  verifiedAt: '2026-07-02',
};

/**
 * Lookup and pricing calculation helpers.
 */
export class PricingCatalog {
  private static readonly index = new Map<string, PricingEntry>(
    PRICING_TABLE.map((e) => [e.modelId, e]),
  );

  /** Returns the pricing entry for a model ID, or a reasonable fallback. */
  static forModel(modelId: string): PricingEntry {
    // Ollama models are always free (local inference)
    if (modelId.includes(':') && !modelId.startsWith('google/') && !modelId.startsWith('qwen/') &&
        !modelId.startsWith('deepseek/') && !modelId.startsWith('meta-llama/') &&
        !modelId.startsWith('mistralai/') && !modelId.startsWith('anthropic/') &&
        !modelId.startsWith('openai/')) {
      // Simple heuristic: Ollama local models don't have provider-style prefixes
      return FREE_PRICING;
    }
    return PricingCatalog.index.get(modelId) ?? UNKNOWN_PRICING;
  }

  /**
   * Calculates the estimated USD cost for a request.
   * @param modelId  Provider's model ID
   * @param inputTokens  Prompt token count
   * @param outputTokens  Completion token count
   */
  static estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const pricing = PricingCatalog.forModel(modelId);
    return (
      (inputTokens / 1_000_000) * pricing.inputCostPerMToken +
      (outputTokens / 1_000_000) * pricing.outputCostPerMToken
    );
  }

  /** Returns all pricing entries. Useful for auditing / displaying in UI. */
  static getAll(): PricingEntry[] {
    return [...PRICING_TABLE];
  }
}
