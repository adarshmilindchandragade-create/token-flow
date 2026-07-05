// src/core/application/ports/IContextPort.ts — Application layer port interfaces

import type { WorkspaceContext, OptimizedContext } from '../../domain/entities/WorkspaceContext';

/**
 * Port for collecting raw workspace context.
 * Implemented by: WorkspaceReader (src/features/workspace/workspaceReader.ts)
 */
export interface IContextPort {
  buildContext(): Promise<WorkspaceContext>;
}

/**
 * Port for optimizing workspace context to reduce token count.
 * Implemented by: TokenOptimizer (src/features/optimizer/tokenOptimizer.ts)
 */
export interface IOptimizerPort {
  optimize(context: WorkspaceContext): Promise<OptimizedContext>;
}
