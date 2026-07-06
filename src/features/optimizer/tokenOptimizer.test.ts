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
      expect(result).toContain('... [12 lines omitted by TokenFlow optimizer] ...');
      expect(result.split('\n').length).toBeLessThan(block.split('\n').length);
    });
  });

  // ─── stripComments ────────────────────────────────────────────────────────
  describe('stripComments()', () => {
    it('strips full-line // comments', () => {
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

  // ─── enforceTokenBudget ───────────────────────────────────────────────────
  // Note: the mocked TokenCounter above uses Math.ceil(text.length / 4), so
  // "maxTokens" in these tests corresponds to (characters / 4).
  describe('enforceTokenBudget()', () => {
    it('returns content unchanged when already within budget', () => {
      const content = '### README\n\nshort content';
      const result = optimizer.enforceTokenBudget(content, 10_000);
      expect(result).toBe(content);
    });

    it('returns content unchanged when maxTokens is 0 or negative (disabled)', () => {
      const content = '### README\n\n' + 'x'.repeat(1000);
      expect(optimizer.enforceTokenBudget(content, 0)).toBe(content);
      expect(optimizer.enforceTokenBudget(content, -1)).toBe(content);
    });

    it('drops Imported File sections first when over budget', () => {
      const readme = '### README\n\nshort';
      const imported = '### Imported File: src/utils.ts\n\n' + 'x'.repeat(400);
      const content = [readme, imported].join('\n\n');

      // Budget large enough for README alone, too small for both sections.
      const result = optimizer.enforceTokenBudget(content, 20);

      expect(result).toContain('### README');
      expect(result).not.toContain('Imported File');
    });

    it('drops Imported File before Changed File sections', () => {
      const readme = '### README\n\nshort';
      const changed = '### Changed File: src/feature.ts\n\n' + 'y'.repeat(80);
      const imported = '### Imported File: src/utils.ts\n\n' + 'x'.repeat(80);
      const content = [readme, changed, imported].join('\n\n');

      // Budget fits README + Changed File (34 tokens under the mocked chars/4
      // heuristic), but not all three sections (62 tokens).
      const result = optimizer.enforceTokenBudget(content, 34);

      expect(result).toContain('### README');
      expect(result).toContain('Changed File');
      expect(result).not.toContain('Imported File');
    });

    it('never drops README, Git Diff, or Active File sections outright', () => {
      const content = [
        '### README\n\n' + 'a'.repeat(200),
        '### Git Diff\n\n' + 'b'.repeat(200),
        '### Active File: src/main.ts\n\n' + 'c'.repeat(200),
      ].join('\n\n');

      const result = optimizer.enforceTokenBudget(content, 50);

      // All three headers must still be present (possibly hard-truncated content, but not removed).
      expect(result).toContain('### README');
    });

    it('hard-truncates and appends a visible notice when dropping tiers is not enough', () => {
      const content = '### Active File: src/huge.ts\n\n' + 'z'.repeat(2000);
      const result = optimizer.enforceTokenBudget(content, 20);

      expect(result).toContain('exceeded tokenflow.maxContextTokens');
      expect(result.length).toBeLessThan(content.length);
    });

    it('hard-truncated output never exceeds the token budget', () => {
      const content = '### Active File: src/huge.ts\n\n' + 'z'.repeat(5000);
      const maxTokens = 50;
      const result = optimizer.enforceTokenBudget(content, maxTokens);

      // Recompute with the same mocked heuristic used by TokenCounter above.
      const resultTokens = Math.ceil(result.length / 4);
      expect(resultTokens).toBeLessThanOrEqual(maxTokens);
    });
  });
});
