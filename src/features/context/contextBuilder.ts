// src/features/context/contextBuilder.ts — Context serialization and IContextPort adapter

import type { IContextPort } from '../../core/application/ports/IContextPort';
import type { WorkspaceContext, FileContent } from '../../core/domain/entities/WorkspaceContext';
import { WorkspaceReader } from '../workspace/workspaceReader';

/**
 * Assembles and serializes workspace context into a prompt-ready string.
 * Delegates collection to WorkspaceReader and implements IContextPort.
 *
 * Responsibility split:
 * - WorkspaceReader: knows *what* to collect and *how* to read from disk/VS Code
 * - ContextBuilder: knows *how to serialize* the collected context into prompt sections
 */
export class ContextBuilder implements IContextPort {
  private readonly reader: WorkspaceReader;

  constructor() {
    this.reader = new WorkspaceReader();
  }

  async buildContext(): Promise<WorkspaceContext> {
    return this.reader.buildContext();
  }

  /**
   * Serializes a WorkspaceContext into a markdown-structured string
   * suitable for inclusion in the `system` or `user` part of a prompt.
   *
   * Section order (matches priority):
   * 1. README (project-level context)
   * 2. Git Diff (what's changing)
   * 3. Active file (what the user is working on)
   * 4. Changed files (broader diff context)
   * 5. Imported files (direct dependencies of active file)
   */
  serializeContext(context: WorkspaceContext): string {
    const sections: string[] = [];

    if (context.readme) {
      sections.push(this.formatSection('README', context.readme.content));
    }

    if (context.gitDiff.trim()) {
      sections.push(this.formatSection('Git Diff', '```diff\n' + context.gitDiff + '\n```'));
    }

    if (context.activeFile) {
      sections.push(
        this.formatSection(
          `Active File: ${context.activeFile.relativePath}`,
          this.formatCode(context.activeFile),
        ),
      );
    }

    for (const file of context.changedFiles) {
      sections.push(
        this.formatSection(`Changed File: ${file.relativePath}`, this.formatCode(file)),
      );
    }

    for (const file of context.importedFiles) {
      sections.push(
        this.formatSection(`Imported File: ${file.relativePath}`, this.formatCode(file)),
      );
    }

    return sections.join('\n\n');
  }

  private formatSection(title: string, content: string): string {
    return `### ${title}\n\n${content}`;
  }

  private formatCode(file: FileContent): string {
    const lang = file.language ?? '';
    return `\`\`\`${lang}\n${file.content}\n\`\`\``;
  }
}
