// src/core/application/useCases/BuildContextUseCase.ts

import type { WorkspaceContext } from '../../domain/entities/WorkspaceContext';
import type { IContextPort } from '../ports/IContextPort';

/**
 * Use case: collect workspace context for inclusion in an AI prompt.
 *
 * Delegates to IContextPort (implemented by WorkspaceReader) so the use case
 * has zero dependency on VS Code APIs — fully testable with a mock port.
 */
export class BuildContextUseCase {
  constructor(private readonly contextPort: IContextPort) {}

  async execute(): Promise<WorkspaceContext> {
    return this.contextPort.buildContext();
  }
}
