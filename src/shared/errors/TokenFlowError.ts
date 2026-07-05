// src/shared/errors/TokenFlowError.ts — Typed error hierarchy for TokenFlow AI

/**
 * All recoverable error codes in the TokenFlow AI extension.
 * Used to give consumers structured error handling without string matching.
 */
export enum TokenFlowErrorCode {
  PROVIDER_NOT_CONFIGURED = 'PROVIDER_NOT_CONFIGURED',
  PROVIDER_API_ERROR = 'PROVIDER_API_ERROR',
  CONTEXT_BUILD_FAILED = 'CONTEXT_BUILD_FAILED',
  OPTIMIZATION_FAILED = 'OPTIMIZATION_FAILED',
  STORAGE_ERROR = 'STORAGE_ERROR',
  GIT_NOT_AVAILABLE = 'GIT_NOT_AVAILABLE',
  TOKEN_COUNT_FAILED = 'TOKEN_COUNT_FAILED',
  /** Thrown by provider stubs (OpenAI, Gemini) until fully implemented. */
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  /** Thrown by middleware when a pipeline error occurs outside the provider. */
  MIDDLEWARE_ERROR = 'MIDDLEWARE_ERROR',
}

/** Structured error class for all TokenFlow AI failures. */
export class TokenFlowError extends Error {
  override readonly name = 'TokenFlowError';

  constructor(
    message: string,
    public readonly code: TokenFlowErrorCode,
    public readonly cause?: Error,
  ) {
    super(message);
    // Maintains proper prototype chain in transpiled JS
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Type guard — narrows `unknown` to `TokenFlowError` for structured catch blocks.
 *
 * @example
 * catch (err) {
 *   if (isTokenFlowError(err)) { vscode.window.showErrorMessage(err.message); }
 * }
 */
export function isTokenFlowError(err: unknown): err is TokenFlowError {
  return err instanceof TokenFlowError;
}
