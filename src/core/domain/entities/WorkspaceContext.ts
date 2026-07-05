// src/core/domain/entities/WorkspaceContext.ts — Workspace context domain entities

/**
 * A single file's content and metadata as collected from the workspace.
 */
export interface FileContent {
  /** Absolute filesystem path. */
  path: string;
  /** Path relative to workspace root (forward-slash normalized). */
  relativePath: string;
  /** Raw UTF-8 file content. */
  content: string;
  /** VS Code language ID (e.g., 'typescript', 'python'). Optional. */
  language?: string;
  /** Pre-computed token count. Populated by TokenCounter after collection. */
  tokenCount?: number;
}

/**
 * The raw workspace context collected by WorkspaceReader before optimization.
 * This is the "before" state — may contain duplicate or noisy content.
 */
export interface WorkspaceContext {
  /** The file currently open in the active editor. Null if no editor is active. */
  activeFile: FileContent | null;
  /** Files modified since the last git commit (per git status / git diff). */
  changedFiles: FileContent[];
  /** Direct (depth-1) imports of the active file, resolved to their source. */
  importedFiles: FileContent[];
  /** README.md at the workspace root, if present and config.includeReadme is true. */
  readme: FileContent | null;
  /** Raw git diff text (unified format). Empty string if no git repo / no changes. */
  gitDiff: string;
  /** Absolute paths of all files reported as changed by git. */
  gitDiffFiles: string[];
}

/**
 * The result of running WorkspaceContext through TokenOptimizer.
 * Contains both original and optimized state for before/after comparison.
 */
export interface OptimizedContext {
  /** The original, unmodified context. */
  original: WorkspaceContext;
  /** Serialized context string after optimization (ready to include in prompt). */
  optimizedContent: string;
  /** Token count of the raw (pre-optimization) serialized context. */
  rawTokenCount: number;
  /** Token count of the optimized context. */
  optimizedTokenCount: number;
  /** Tokens saved: rawTokenCount - optimizedTokenCount. Always >= 0. */
  savedTokens: number;
  /** Savings as a percentage of rawTokenCount. Range: 0–100. */
  savingsPercent: number;
}
