// src/features/tokenMonitor/tokenCounter.ts — Re-export shim
// The implementation was moved to src/services/tokenizer/TokenCounter.ts in v1.1.
// This file is kept to preserve import paths for existing callers.
//
// Bug #2 fix: the previous version was a full second implementation, spinning up
// a second WASM encoder. This shim ensures a single TokenCounter instance.
export { TokenCounter } from '../../services/tokenizer/TokenCounter';
