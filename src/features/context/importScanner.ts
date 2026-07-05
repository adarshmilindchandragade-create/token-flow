// src/features/context/importScanner.ts — Depth-1 static import resolution
// Extracts direct imports from TypeScript/JavaScript source files.

import * as path from 'path';
import * as fs from 'fs';

/**
 * Extracts and resolves direct (depth-1) relative imports from source content.
 * Supports ES module `import ... from` and CommonJS `require(...)` syntax.
 *
 * Only resolves relative imports (starting with '.') to avoid expanding
 * node_modules into context — those are excluded by FileFilter.
 *
 * No AST parsing in v1 — regex-based for speed and simplicity.
 * Tree-sitter AST parsing deferred to v2 (ADR-003).
 */
export class ImportScanner {
  // Matches: import ... from '...' | import '...' | require('...')
  private static readonly IMPORT_REGEX =
    /(?:import\s+(?:.*?\s+from\s+)?|require\s*\(\s*)['"]([^'"]+)['"]/g;

  /**
   * @param content     Source file content to scan
   * @param sourceFilePath Absolute path of the source file (used to resolve relative imports)
   * @returns Deduplicated list of resolved absolute file paths
   */
  extractImports(content: string, sourceFilePath: string): string[] {
    const dir = path.dirname(sourceFilePath);
    const resolvedPaths = new Set<string>();

    let match: RegExpExecArray | null;
    ImportScanner.IMPORT_REGEX.lastIndex = 0; // reset stateful regex

    while ((match = ImportScanner.IMPORT_REGEX.exec(content)) !== null) {
      const importSpecifier = match[1];
      // Skip node_modules / bare imports (no leading dot)
      if (!importSpecifier || !importSpecifier.startsWith('.')) continue;

      const resolved = this.resolveImportPath(dir, importSpecifier);
      if (resolved) {
        resolvedPaths.add(resolved);
      }
    }

    return [...resolvedPaths];
  }

  /**
   * Resolves a relative import specifier to an absolute filesystem path.
   * Tries common TypeScript/JavaScript extensions and index file fallbacks.
   * Returns null if no file can be found on disk.
   */
  private resolveImportPath(dir: string, importSpecifier: string): string | null {
    const base = path.resolve(dir, importSpecifier);

    // Try with common extensions (exact match first, then appended)
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.js`,
      `${base}.jsx`,
      `${base}.mts`,
      `${base}.mjs`,
      path.join(base, 'index.ts'),
      path.join(base, 'index.tsx'),
      path.join(base, 'index.js'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }

    return null;
  }
}
