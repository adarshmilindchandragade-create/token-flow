// src/features/workspace/fileFilter.ts — Workspace file inclusion/exclusion rules

import * as path from 'path';
import * as vscode from 'vscode';
import {
  EXCLUDED_PATH_SEGMENTS,
  EXCLUDED_EXTENSIONS,
  EXCLUDED_FILENAMES,
} from '../../shared/constants';

/** Extensions treated as readable text source files. */
const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.cs',
  '.cpp',
  '.c',
  '.h',
  '.html',
  '.css',
  '.scss',
  '.less',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.md',
  '.txt',
  '.sh',
  '.bash',
  '.zsh',
  '.fish',
  '.sql',
  '.graphql',
  '.gql',
  '.xml',
  '.env.example',
]);

/**
 * Determines which workspace files should be included in AI context.
 * All decisions are pure functions — no I/O, fully testable.
 */
export class FileFilter {
  private readonly workspaceRoot: string;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
  }

  /**
   * Returns true if the file at `filePath` should be included in context.
   * Checks path segments, extension, and filename against exclusion lists.
   */
  shouldInclude(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    const basename = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // Check filename exclusions (exact match)
    if (EXCLUDED_FILENAMES.has(basename)) return false;

    // Check extension exclusions
    if (EXCLUDED_EXTENSIONS.has(ext)) return false;

    // Check path segment exclusions — segment must be a complete directory name,
    // not a substring of a filename (e.g., 'build' should not match 'build.py')
    for (const segment of EXCLUDED_SEGMENTS) {
      // Match: /segment/ (interior) OR /segment at end of string
      if (normalized.includes(`/${segment}/`) || normalized.endsWith(`/${segment}`)) {
        return false;
      }
    }

    return true;
  }

  /** Returns true if the file extension is recognized as a text/source file. */
  isTextFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    // Also allow dotfiles (e.g., .gitignore, .prettierrc) without extension
    return TEXT_EXTENSIONS.has(ext) || (ext === '' && path.basename(filePath).startsWith('.'));
  }

  /**
   * Returns the path relative to the workspace root, forward-slash normalized.
   * Absolute paths outside the workspace are returned as-is.
   */
  getRelativePath(absolutePath: string): string {
    return path.relative(this.workspaceRoot, absolutePath).replace(/\\/g, '/');
  }

  /**
   * Filters an array of absolute paths to only those that pass shouldInclude() and isTextFile().
   */
  filterFiles(filePaths: string[]): string[] {
    return filePaths.filter((f) => this.shouldInclude(f) && this.isTextFile(f));
  }
}

// Cast to string[] so we can use Array.includes on a readonly tuple
const EXCLUDED_SEGMENTS: string[] = [...EXCLUDED_PATH_SEGMENTS];
