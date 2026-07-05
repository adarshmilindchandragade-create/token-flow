// src/shared/events/ProviderEventBus.ts — Typed event bus for provider lifecycle events
// Status bar and token monitor subscribe here — they never call providers directly.

import { EventEmitter } from 'events';
import type { AIResponse } from '../../core/domain/AIRequest';

// ─── Event payload types ──────────────────────────────────────────────────────

/** Emitted immediately before a request is dispatched to the provider. */
export interface RequestStartedEvent {
  type: 'started';
  requestId: string;
  provider: string;
  model: string;
  timestamp: Date;
}

/** Emitted for each incremental chunk during a streaming response. */
export interface RequestChunkEvent {
  type: 'chunk';
  requestId: string;
  /** Incremental text (not cumulative). */
  content: string;
}

/** Emitted once a complete response is available (streaming or non-streaming). */
export interface RequestCompletedEvent {
  type: 'completed';
  requestId: string;
  response: AIResponse;
  durationMs: number;
}

/** Emitted when a request fails after all retries are exhausted. */
export interface RequestFailedEvent {
  type: 'failed';
  requestId: string;
  provider: string;
  error: Error;
}

/** Discriminated union of all provider events. */
export type ProviderEvent =
  RequestStartedEvent | RequestChunkEvent | RequestCompletedEvent | RequestFailedEvent;

// ─── Event bus ───────────────────────────────────────────────────────────────

const PROVIDER_CHANNEL = 'provider';

/**
 * Singleton-style event bus for provider lifecycle events.
 *
 * Producers:  MetricsMiddleware emits events
 * Consumers:  TokenStatusBar, TokenMonitorPanel subscribe
 *
 * This decouples UI components from the provider pipeline —
 * neither the status bar nor the panel need to import any provider code.
 */
export class ProviderEventBus extends EventEmitter {
  constructor() {
    super();
    // Prevent Node.js 'MaxListenersExceeded' warning for long-lived processes
    this.setMaxListeners(20);
  }

  /**
   * Emits a provider lifecycle event on the shared channel.
   */
  dispatch(event: ProviderEvent): void {
    this.emit(PROVIDER_CHANNEL, event);
  }

  /**
   * Subscribes to all provider lifecycle events.
   * Returns `this` for chaining.
   */
  onProviderEvent(handler: (event: ProviderEvent) => void): this {
    return this.on(PROVIDER_CHANNEL, handler);
  }

  /**
   * Subscribes to a specific event type using a type-narrowed handler.
   */
  onCompleted(handler: (event: RequestCompletedEvent) => void): this {
    return this.on(PROVIDER_CHANNEL, (event: ProviderEvent) => {
      if (event.type === 'completed') handler(event);
    });
  }

  onFailed(handler: (event: RequestFailedEvent) => void): this {
    return this.on(PROVIDER_CHANNEL, (event: ProviderEvent) => {
      if (event.type === 'failed') handler(event);
    });
  }
}
