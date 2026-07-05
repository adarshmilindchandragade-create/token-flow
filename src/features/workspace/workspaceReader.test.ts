// src/features/workspace/workspaceReader.test.ts — Unit tests for workspace feature

import { describe, it, expect, beforeEach } from 'vitest';
import { FileFilter } from './fileFilter';

// Note: WorkspaceReader and GitIntegration depend on VS Code APIs and cannot be
// unit tested without mocking the vscode module. They are covered by integration
// tests (F5 Extension Development Host). FileFilter is pure and fully testable.

describe('FileFilter', () => {
  let filter: FileFilter;

  beforeEach(() => {
    // FileFilter reads workspace root from VS Code API in the constructor.
    // In test environment (no VS Code), it falls back to process.cwd().
    filter = new FileFilter();
  });

  describe('shouldInclude()', () => {
    it('excludes node_modules paths', () => {
      expect(filter.shouldInclude('/project/node_modules/lodash/index.js')).toBe(false);
    });

    it('excludes dist/ paths', () => {
      expect(filter.shouldInclude('/project/dist/extension.js')).toBe(false);
    });

    it('excludes .git/ paths', () => {
      expect(filter.shouldInclude('/project/.git/HEAD')).toBe(false);
    });

    it('excludes package-lock.json by filename', () => {
      expect(filter.shouldInclude('/project/package-lock.json')).toBe(false);
    });

    it('excludes yarn.lock by filename', () => {
      expect(filter.shouldInclude('/project/yarn.lock')).toBe(false);
    });

    it('excludes .map files by extension', () => {
      expect(filter.shouldInclude('/project/dist/extension.js.map')).toBe(false);
    });

    it('includes TypeScript source files', () => {
      expect(filter.shouldInclude('/project/src/extension.ts')).toBe(true);
    });

    it('includes Python files', () => {
      expect(filter.shouldInclude('/project/scripts/build.py')).toBe(true);
    });

    it('includes markdown files', () => {
      expect(filter.shouldInclude('/project/README.md')).toBe(true);
    });
  });

  describe('isTextFile()', () => {
    it('recognizes .ts as text', () => {
      expect(filter.isTextFile('src/extension.ts')).toBe(true);
    });

    it('recognizes .json as text', () => {
      expect(filter.isTextFile('package.json')).toBe(true);
    });

    it('recognizes dotfiles as text', () => {
      expect(filter.isTextFile('.gitignore')).toBe(true);
      expect(filter.isTextFile('.prettierrc')).toBe(true);
    });

    it('rejects .png as non-text', () => {
      expect(filter.isTextFile('logo.png')).toBe(false);
    });

    it('rejects .vsix as non-text', () => {
      expect(filter.isTextFile('extension.vsix')).toBe(false);
    });
  });

  describe('filterFiles()', () => {
    it('filters out excluded files and keeps valid source files', () => {
      const input = [
        '/project/src/extension.ts',
        '/project/node_modules/lodash/index.js',
        '/project/dist/extension.js',
        '/project/README.md',
        '/project/package-lock.json',
      ];

      const result = filter.filterFiles(input);

      expect(result).toContain('/project/src/extension.ts');
      expect(result).toContain('/project/README.md');
      expect(result).not.toContain('/project/node_modules/lodash/index.js');
      expect(result).not.toContain('/project/dist/extension.js');
      expect(result).not.toContain('/project/package-lock.json');
    });

    it('returns empty array for all-excluded input', () => {
      const input = ['/project/node_modules/x.js', '/project/dist/y.js'];
      expect(filter.filterFiles(input)).toHaveLength(0);
    });
  });
});
