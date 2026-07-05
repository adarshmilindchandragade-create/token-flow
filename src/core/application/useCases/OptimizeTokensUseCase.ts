// src/core/application/useCases/OptimizeTokensUseCase.ts

import type { WorkspaceContext, OptimizedContext } from '../../domain/entities/WorkspaceContext';
import type { IOptimizerPort } from '../ports/IContextPort';

/**
 * Use case: optimize workspace context to reduce tokens before sending to a provider.
 *
 * Delegates to IOptimizerPort (implemented by TokenOptimizer) so the use case
 * has zero dependency on tiktoken or VS Code APIs — fully testable with a mock port.
 */
export class OptimizeTokensUseCase {
  constructor(private readonly optimizerPort: IOptimizerPort) {}

  async execute(context: WorkspaceContext): Promise<OptimizedContext> {
    return this.optimizerPort.optimize(context);
  }
}
