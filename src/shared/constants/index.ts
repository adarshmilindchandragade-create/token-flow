// src/shared/constants/index.ts — Application-wide constants for TokenFlow AI

/** Extension ID matching package.json "name" */
export const EXTENSION_ID = 'tokenflow-ai';
export const EXTENSION_NAME = 'TokenFlow AI';

// ─── VS Code Command IDs ───────────────────────────────────────────────────
export const COMMAND_SHOW_MONITOR = 'tokenflow.showTokenMonitor';
export const COMMAND_SET_API_KEY = 'tokenflow.setApiKey';
export const COMMAND_SEND_PROMPT = 'tokenflow.sendPrompt';
export const COMMAND_SHOW_BEFORE_AFTER = 'tokenflow.showBeforeAfter';
export const COMMAND_RESET_SESSION = 'tokenflow.resetSession';
/** Opens the provider quick-pick for hot-switching without restart. */
export const COMMAND_SELECT_PROVIDER = 'tokenflow.selectProvider';
/** Opens the model quick-pick for the active provider. */
export const COMMAND_SELECT_MODEL = 'tokenflow.selectModel';

// ─── SecretStorage key prefix ──────────────────────────────────────────────
/** Prefix for API keys stored in VS Code SecretStorage: `tokenflow.apiKey.<provider>` */
export const SECRET_KEY_PREFIX = 'tokenflow.apiKey';

// ─── Context health thresholds (fraction of context window) ───────────────
export const TOKEN_THRESHOLDS = {
  /** 🟢 < 33% — proceed normally */
  LOW: 0.33,
  /** 🟡 33–66% — compress completed modules */
  MODERATE: 0.66,
  /** 🔴 > 66% — generate PROJECT_MEMORY.md snapshot */
  HIGH: 0.85,
} as const;

// ─── Defaults ──────────────────────────────────────────────────────────────
export const DEFAULT_MAX_CONTEXT_TOKENS = 100_000;
/** Default provider — OpenRouter with a free model for zero-cost development. */
export const DEFAULT_PROVIDER = 'openrouter';
/** Default model for OpenRouter (free tier). */
export const DEFAULT_MODEL = 'google/gemma-3-12b-it:free';
/** Default Anthropic model for production use. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-sonnet-20241022';

// ─── File/directory exclusion patterns ────────────────────────────────────
/**
 * Paths containing any of these strings are excluded from context collection.
 * Intentionally broad — keeps binaries, generated output, and secrets out of prompts.
 */
export const EXCLUDED_PATH_SEGMENTS = [
  'node_modules',
  'dist',
  'out',
  '.git',
  'coverage',
  '.next',
  '.nuxt',
  'build',
  '__pycache__',
  '.venv',
  'venv',
  '.env',
] as const;

/** Binary/generated file extensions to exclude from context. */
export const EXCLUDED_EXTENSIONS = new Set([
  '.map',
  '.min.js',
  '.min.css',
  '.vsix',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.lock',
  '.snap',
]);

/** Files excluded by name (not extension). */
export const EXCLUDED_FILENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
]);
