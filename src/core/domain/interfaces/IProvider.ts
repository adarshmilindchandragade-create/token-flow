// src/core/domain/interfaces/IProvider.ts — Re-export shim
// This file is kept for backward compatibility.
// The canonical IProvider is now in src/providers/base/IProvider.ts
// All new code should import from the providers layer directly.

export type {
  IProvider,
  ProviderName,
  AIRequest,
  AIResponse,
  StreamChunkHandler,
  ProviderCapabilities,
  ProviderHealth,
} from '../../../providers/base/IProvider';

// Backward-compatibility type aliases (previously defined here)
export type { ProviderMessage, ProviderRequest, ProviderResponse } from '../AIRequest';
