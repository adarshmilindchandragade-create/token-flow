// src/features/context/contextBuilder.test.ts — Unit tests for ContextBuilder

import { describe, it, expect } from 'vitest';
import { ContextBuilder } from './contextBuilder';
import type { WorkspaceContext } from '../../core/domain/entities/WorkspaceContext';

describe('ContextBuilder.serializeContext()', () => {
  const builder = new ContextBuilder();

  const emptyContext: WorkspaceContext = {
    activeFile: null,
    changedFiles: [],
    importedFiles: [],
    readme: null,
    gitDiff: '',
    gitDiffFiles: [],
  };

  it('returns empty string for empty context', () => {
    const result = builder.serializeContext(emptyContext);
    expect(result).toBe('');
  });

  it('includes README section when present', () => {
    const ctx: WorkspaceContext = {
      ...emptyContext,
      readme: { path: '/proj/README.md', relativePath: 'README.md', content: '# My Project' },
    };
    const result = builder.serializeContext(ctx);
    expect(result).toContain('### README');
    expect(result).toContain('# My Project');
  });

  it('includes git diff section when diff is non-empty', () => {
    const ctx: WorkspaceContext = {
      ...emptyContext,
      gitDiff: '--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@',
    };
    const result = builder.serializeContext(ctx);
    expect(result).toContain('### Git Diff');
    expect(result).toContain('```diff');
  });

  it('does not include git diff section when diff is empty', () => {
    const result = builder.serializeContext(emptyContext);
    expect(result).not.toContain('### Git Diff');
  });

  it('includes active file with correct language tag', () => {
    const ctx: WorkspaceContext = {
      ...emptyContext,
      activeFile: {
        path: '/proj/src/extension.ts',
        relativePath: 'src/extension.ts',
        content: 'export function activate() {}',
        language: 'typescript',
      },
    };
    const result = builder.serializeContext(ctx);
    expect(result).toContain('### Active File: src/extension.ts');
    expect(result).toContain('```typescript');
    expect(result).toContain('export function activate() {}');
  });

  it('includes changed files', () => {
    const ctx: WorkspaceContext = {
      ...emptyContext,
      changedFiles: [
        {
          path: '/proj/src/feature.ts',
          relativePath: 'src/feature.ts',
          content: 'const x = 1;',
        },
      ],
    };
    const result = builder.serializeContext(ctx);
    expect(result).toContain('### Changed File: src/feature.ts');
  });

  it('includes imported files', () => {
    const ctx: WorkspaceContext = {
      ...emptyContext,
      importedFiles: [
        {
          path: '/proj/src/utils.ts',
          relativePath: 'src/utils.ts',
          content: 'export const util = () => {};',
        },
      ],
    };
    const result = builder.serializeContext(ctx);
    expect(result).toContain('### Imported File: src/utils.ts');
  });

  it('renders sections in priority order: README, diff, active, changed, imported', () => {
    const ctx: WorkspaceContext = {
      activeFile: {
        path: '/proj/src/a.ts',
        relativePath: 'src/a.ts',
        content: 'const a = 1;',
      },
      changedFiles: [{ path: '/proj/src/b.ts', relativePath: 'src/b.ts', content: 'const b = 2;' }],
      importedFiles: [{ path: '/proj/src/c.ts', relativePath: 'src/c.ts', content: 'const c = 3;' }],
      readme: { path: '/proj/README.md', relativePath: 'README.md', content: '# Proj' },
      gitDiff: 'diff --git a/x b/x',
      gitDiffFiles: [],
    };
    const result = builder.serializeContext(ctx);
    const readmeIdx = result.indexOf('### README');
    const diffIdx = result.indexOf('### Git Diff');
    const activeIdx = result.indexOf('### Active File');
    const changedIdx = result.indexOf('### Changed File');
    const importedIdx = result.indexOf('### Imported File');

    expect(readmeIdx).toBeLessThan(diffIdx);
    expect(diffIdx).toBeLessThan(activeIdx);
    expect(activeIdx).toBeLessThan(changedIdx);
    expect(changedIdx).toBeLessThan(importedIdx);
  });
});
