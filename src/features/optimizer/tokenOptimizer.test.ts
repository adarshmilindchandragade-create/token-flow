// src/features/optimizer/tokenOptimizer.test.ts — Unit tests for TokenOptimizer

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenOptimizer } from './tokenOptimizer';

// Mock the vscode module — not available outside VS Code host
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(false), // stripComments: false by default
    }),
  },
}));

// Mock ContextBuilder — optimizer tests focus on the transformation logic only
vi.mock('../context/contextBuilder', () => ({
  ContextBuilder: vi.fn().mockImplementation(function () {
    return {
      serializeContext: vi.fn().mockReturnValue(''),
      buildContext: vi.fn(),
    };
  }),
}));

// Mock TokenCounter — return character/4 for deterministic counts
vi.mock('../tokenMonitor/tokenCounter', () => ({
  TokenCounter: vi.fn().mockImplementation(function () {
    return {
      count: vi.fn().mockImplementation((text: string) => Math.ceil(text.length / 4)),
    };
  }),
}));

describe('TokenOptimizer (pure transformation methods)', () => {
  let optimizer: TokenOptimizer;

  beforeEach(() => {
    optimizer = new TokenOptimizer();
  });

  // ─── collapseWhitespace ───────────────────────────────────────────────────
  describe('collapseWhitespace()', () => {
    it('collapses 3+ consecutive blank lines to one', () => {
      const input = 'line1\n\n\n\nline2';
      expect(optimizer.collapseWhitespace(input)).toBe('line1\n\nline2');
    });

    it('leaves single blank lines intact', () => {
      const input = 'line1\n\nline2';
      expect(optimizer.collapseWhitespace(input)).toBe('line1\n\nline2');
    });

    it('leaves text without blank lines intact', () => {
      const input = 'line1\nline2';
      expect(optimizer.collapseWhitespace(input)).toBe('line1\nline2');
    });
  });

  // ─── truncateLongCodeBlocks ───────────────────────────────────────────────
  describe('truncateLongCodeBlocks()', () => {
    it('leaves short code blocks intact', () => {
      const lines = Array.from({ length: 10 }, (_, i) => `line ${i}`).join('\n');
      const block = '```ts\n' + lines + '\n```';
      expect(optimizer.truncateLongCodeBlocks(block)).toBe(block);
    });

    it('truncates code blocks longer than 50 lines', () => {
      const lines = Array.from({ length: 60 }, (_, i) => `const x${i} = ${i};`).join('\n');
      const block = '```ts\n' + lines + '\n```';
      const result = optimizer.truncateLongCodeBlocks(block);
      // block = opening fence + 60 content lines + closing fence = 62 lines total
      // omitted = 62 - 50 = 12 lines
      expect(result).toContain('... [12 lines omitted by TokenFlow optimizer] ...');
      expect(result.split('\n').length).toBeLessThan(block.split('\n').length);
    });
  });

  // ─── stripComments ────────────────────────────────────────────────────────
  describe('stripComments()', () => {
    it('strips full-line // comments', () => {
      // The v1 stripComments regex strips full-line comments (^\/\/.*).
      // Inline trailing comments (const x = 1; // ...) are NOT stripped in v1
      // to avoid incorrectly removing code on the same line.
      // See KNOWN_ISSUES.md — full inline stripping deferred to v2 (AST required).
      const input = '// this is a full-line comment\nconst y = 2;';
      const result = optimizer.stripComments(input);
      expect(result).not.toContain('// this is a full-line comment');
      expect(result).toContain('const y = 2;');
    });

    it('strips block comments', () => {
      const input = '/* block comment */\nconst x = 1;';
      const result = optimizer.stripComments(input);
      expect(result).not.toContain('block comment');
      expect(result).toContain('const x = 1;');
    });

    it('preserves shebangs (#!/...)', () => {
      const input = '#!/usr/bin/env node\nconst x = 1;';
      const result = optimizer.stripComments(input);
      expect(result).toContain('#!/usr/bin/env node');
    });
  });

  // ─── deduplicateSections ─────────────────────────────────────────────────
  describe('deduplicateSections()', () => {
    it('removes duplicate sections with the same header', () => {
      const section = '### Active File: src/a.ts\n\n```ts\nconst x = 1;\n```';
      const input = section + '\n\n### ' + section;
      const result = optimizer.deduplicateSections(input);
      const count = (result.match(/### Active File: src\/a\.ts/g) ?? []).length;
      expect(count).toBe(1);
    });

    it('keeps sections with different headers', () => {
      const input =
        '### Active File: src/a.ts\n\ncontent1\n\n### Changed File: src/b.ts\n\ncontent2';
      const result = optimizer.deduplicateSections(input);
      expect(result).toContain('### Active File: src/a.ts');
      expect(result).toContain('### Changed File: src/b.ts');
    });
  });
});
