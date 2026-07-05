// src/services/tokenizer/TokenCounter.ts — Token counting with js-tiktoken + fallback
// Moved from src/features/tokenMonitor/tokenCounter.ts.
// src/features/tokenMonitor/tokenCounter.ts is now a re-export shim.

import { getEncoding, type TiktokenEncoding } from 'js-tiktoken';

/**
 * Counts tokens using the cl100k_base encoding (GPT-4 / Claude-compatible).
 * Falls back to character-count/4 heuristic if the WASM module fails to load.
 *
 * Usage:
 *   const counter = new TokenCounter();
 *   const count = counter.count('hello world');
 *   counter.dispose();
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
    }
  }

  /**
   * Returns the token count for the given text.
   * Uses tiktoken when available; falls back to `Math.ceil(text.length / 4)`.
   */
  count(text: string): number {
    if (this.encoder) {
      try {
        return this.encoder.encode(text).length;
      } catch {
        // Encoder error — fall through to character fallback
      }
    }
    return Math.ceil(text.length / 4);
  }

  /**
   * Returns the fraction of a context window occupied by the given token count.
   * @param tokenCount  Number of tokens in the prompt
   * @param windowSize  Provider's maximum context window
   */
  static contextFraction(tokenCount: number, windowSize: number): number {
    if (windowSize <= 0) return 0;
    return Math.min(tokenCount / windowSize, 1);
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
