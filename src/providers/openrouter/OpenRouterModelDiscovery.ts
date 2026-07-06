// src/providers/openrouter/OpenRouterModelDiscovery.ts
// Dynamically discovers free models from GET /api/v1/models.
// Ranks them by capability score and caches results for 24 hours.
// This replaces the brittle hardcoded free model list.

import { Logger } from '../../shared/utils/logger';

/** Raw model entry from OpenRouter /api/v1/models. */
interface OpenRouterApiModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
  pricing: {
    prompt: string; // cost per token as string e.g. "0" or "0.000001"
    completion: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  supported_parameters?: string[];
}

interface OpenRouterModelsResponse {
  data: OpenRouterApiModel[];
}

/** Ranked free model ready for use. */
export interface RankedFreeModel {
  id: string;
  displayName: string;
  contextLength: number;
  score: number;
  supportsStreaming: boolean;
  supportsThinking: boolean;
}

/** Cache entry. */
interface ModelCache {
  models: RankedFreeModel[];
  fetchedAt: number; // epoch ms
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours
const MIN_CONTEXT = 64_000;
const BASE_URL = 'https://openrouter.ai/api/v1';

/** Keywords that indicate a coding-oriented model. */
const CODING_KEYWORDS = ['coder', 'code', 'deepseek', 'qwen', 'starcoder', 'codestral'];
/** Keywords for reasoning/thinking models. */
const REASONING_KEYWORDS = ['r1', 'reason', 'think', 'o1', 'o3', 'reflect'];
/** Keywords for deprecation / instability. */
const DEPRECATED_KEYWORDS = ['preview', 'exp', 'alpha', 'beta', 'draft'];

export class OpenRouterModelDiscovery {
  private static cache: ModelCache | null = null;
  private static readonly logger = Logger.getInstance();

  /**
   * Returns the best available free model ID, preferring coding models.
   * Falls back to 'openrouter/free' if discovery fails.
   */
  static async getBestFreeModelId(apiKey: string): Promise<string> {
    try {
      const models = await this.getrankedFreeModels(apiKey);
      if (models.length > 0) {
        this.logger.info(`[Discovery] Selected: ${models[0].id} (score=${models[0].score})`);
        return models[0].id;
      }
    } catch (err) {
      this.logger.warn(
        `[Discovery] Model discovery failed, using openrouter/free — ${String(err)}`,
      );
    }
    return 'openrouter/free';
  }

  /**
   * Returns all ranked free models. Uses cache if fresh.
   */
  static async getrankedFreeModels(apiKey: string): Promise<RankedFreeModel[]> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      this.logger.info(
        `[Discovery] Using cached model list (${this.cache.models.length} free models)`,
      );
      return this.cache.models;
    }

    this.logger.info('[Discovery] Fetching fresh model list from OpenRouter...');
    const all = await this.fetchAllModels(apiKey);
    const free = this.filterFreeModels(all);
    const ranked = this.rankModels(free);

    this.cache = { models: ranked, fetchedAt: Date.now() };
    this.logger.info(
      `[Discovery] Found ${ranked.length} free models. Top: ${ranked[0]?.id ?? 'none'}`,
    );
    return ranked;
  }

  /** Force a fresh fetch on next call. */
  static invalidateCache(): void {
    this.cache = null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private static async fetchAllModels(apiKey: string): Promise<OpenRouterApiModel[]> {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/tokenflow-ai/tokenflow-ai',
        'X-Title': 'TokenFlow AI',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch models: ${res.status} ${res.statusText}`);
    }

    const body = (await res.json()) as OpenRouterModelsResponse;
    return body.data ?? [];
  }

  private static filterFreeModels(models: OpenRouterApiModel[]): OpenRouterApiModel[] {
    return models.filter((m) => {
      // Must be text/chat (not embedding, image, etc.)
      const modality = m.architecture?.modality ?? '';
      if (modality && !modality.includes('text')) return false;

      // Must be free (prompt + completion both 0)
      const promptCost = parseFloat(m.pricing.prompt ?? '1');
      const completionCost = parseFloat(m.pricing.completion ?? '1');
      if (promptCost !== 0 || completionCost !== 0) return false;

      // Must meet minimum context window
      if ((m.context_length ?? 0) < MIN_CONTEXT) return false;

      return true;
    });
  }

  private static rankModels(models: OpenRouterApiModel[]): RankedFreeModel[] {
    const scored = models.map((m) => {
      const id = m.id.toLowerCase();
      const name = (m.name ?? m.id).toLowerCase();
      let score = 0;

      // Coding model bonus (+40)
      if (CODING_KEYWORDS.some((kw) => id.includes(kw) || name.includes(kw))) score += 40;

      // Free tier — all passed our filter so all get this (+30)
      score += 30;

      // Streaming support (+20)
      const supportsStreaming =
        !m.supported_parameters || m.supported_parameters.includes('stream');
      if (supportsStreaming) score += 20;

      // Long context bonus (+15 if > 128K)
      if ((m.context_length ?? 0) >= 128_000) score += 15;

      // Reasoning / thinking models (+10)
      const supportsThinking = REASONING_KEYWORDS.some(
        (kw) => id.includes(kw) || name.includes(kw),
      );
      if (supportsThinking) score += 10;

      // Deprecation / instability penalty (-100)
      if (DEPRECATED_KEYWORDS.some((kw) => id.includes(kw))) score -= 100;

      // Prefer larger models within same family (rough proxy: context length)
      score += Math.min(10, Math.floor((m.context_length ?? 0) / 10_000));

      return {
        id: m.id,
        displayName: m.name ?? m.id,
        contextLength: m.context_length ?? 0,
        score,
        supportsStreaming,
        supportsThinking,
      } satisfies RankedFreeModel;
    });

    // Sort descending by score, then alphabetically as tiebreaker
    return scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  }
}
