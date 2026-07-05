// src/features/tokenMonitor/tokenCounter.ts — Token counting with js-tiktoken

import { getEncoding, type TiktokenEncoding } from 'js-tiktoken';

/**
 * Counts tokens in a text string using the cl100k_base encoding.
 * This encoding is used by Claude and GPT-4 models — counts are an approximation
 * for Anthropic (which uses a proprietary tokenizer internally).
 *
 * Falls back to character/4 estimation if tiktoken initialization fails.
 *
 * Known limitation: documented in KNOWN_ISSUES.md
 * Fix in v2: use provider-specific token counting from API response for display.
 */
export class TokenCounter {
  private static readonly ENCODING: TiktokenEncoding = 'cl100k_base';
  private encoder: ReturnType<typeof getEncoding> | null = null;

  constructor() {
    try {
      this.encoder = getEncoding(TokenCounter.ENCODING);
    } catch {
      // tiktoken may fail in certain environments (e.g., test runners without WASM)
      // Character fallback keeps the optimizer functional
      this.encoder = null;
    }
  }

  /**
   * Returns the estimated token count for `text`.
   * Uses tiktoken if available, otherwise falls back to Math.ceil(text.length / 4).
   */
  count(text: string): number {
    if (!text) return 0;

    if (this.encoder) {
      try {
        return this.encoder.encode(text).length;
      } catch {
        // Fallthrough to character estimation
      }
    }

    return Math.ceil(text.length / 4);
  }

  /**
   * Releases the encoder reference.
   * js-tiktoken manages WASM memory internally; nulling the reference
   * allows the GC to reclaim it.
   */
  dispose(): void {
    this.encoder = null;
  }
}
