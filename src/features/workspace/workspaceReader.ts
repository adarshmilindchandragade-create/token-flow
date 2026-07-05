// src/features/workspace/workspaceReader.ts — Implements IContextPort
// Collects workspace context: active file, git diff files, imports, README

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { IContextPort } from '../../core/application/ports/IContextPort';
import type { WorkspaceContext, FileContent } from '../../core/domain/entities/WorkspaceContext';
import { GitIntegration } from './gitIntegration';
import { FileFilter } from './fileFilter';
import { Logger } from '../../shared/utils/logger';

/**
 * Collects workspace context for AI context building.
 * Implements IContextPort so it can be consumed by BuildContextUseCase.
 *
 * Sources (in priority order):
 * 1. Active file (currently open in editor)
 * 2. Git diff files (changed since last commit)
 * 3. Direct imports of the active file (depth-1)
 * 4. README.md (if config.includeReadme is true)
 */
export class WorkspaceReader implements IContextPort {
  private readonly git = new GitIntegration();
  private readonly filter = new FileFilter();
  private readonly logger = Logger.getInstance();

  async buildContext(): Promise<WorkspaceContext> {
    const config = vscode.workspace.getConfiguration('tokenflow');
    const includeReadme = config.get<boolean>('includeReadme', true);

    const [activeFile, gitResult, readme] = await Promise.all([
      this.getActiveFile(),
      this.git.getDiff().catch((err: Error) => {
        this.logger.warn(`Git diff failed: ${err.message}`);
        return { diff: '', changedFiles: [] };
      }),
      includeReadme ? this.getReadme() : Promise.resolve(null),
    ]);

    const changedFiles = await this.readFiles(
      this.filter.filterFiles(gitResult.changedFiles),
    );

    // Avoid re-reading the active file if it's also in changedFiles
    const activeFilePath = activeFile?.path;
    const filteredChangedFiles = changedFiles.filter(
      (f) => f.path !== activeFilePath,
    );

    const importedFiles = activeFile
      ? await this.getImportedFiles(activeFile)
      : [];

    return {
      activeFile,
      changedFiles: filteredChangedFiles,
      importedFiles,
      readme,
      gitDiff: gitResult.diff,
      gitDiffFiles: gitResult.changedFiles,
    };
  }

  private getActiveFile(): Promise<FileContent | null> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return Promise.resolve(null);

    const filePath = editor.document.uri.fsPath;
    if (!this.filter.shouldInclude(filePath)) return Promise.resolve(null);

    return Promise.resolve({
      path: filePath,
      relativePath: this.filter.getRelativePath(filePath),
      content: editor.document.getText(),
      language: editor.document.languageId,
    });
  }

  private getReadme(): Promise<FileContent | null> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return Promise.resolve(null);

    const readmePath = path.join(workspaceRoot, 'README.md');
    if (!fs.existsSync(readmePath)) return Promise.resolve(null);

    try {
      return Promise.resolve({
        path: readmePath,
        relativePath: 'README.md',
        content: fs.readFileSync(readmePath, 'utf-8'),
        language: 'markdown',
      });
    } catch (err) {
      this.logger.warn(`Could not read README.md: ${String(err)}`);
      return Promise.resolve(null);
    }
  }

  private readFiles(filePaths: string[]): Promise<FileContent[]> {
    const results: FileContent[] = [];

    for (const filePath of filePaths) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        results.push({
          path: filePath,
          relativePath: this.filter.getRelativePath(filePath),
          content,
        });
      } catch {
        this.logger.debug(`Skipping unreadable file: ${filePath}`);
      }
    }

    return Promise.resolve(results);
  }

  private async getImportedFiles(activeFile: FileContent): Promise<FileContent[]> {
    // Lazy import to avoid circular dependency
    const { ImportScanner } = await import('../context/importScanner');
    const scanner = new ImportScanner();
    const importPaths = scanner.extractImports(activeFile.content, activeFile.path);
    const filteredPaths = this.filter.filterFiles(importPaths);
    return this.readFiles(filteredPaths);
  }
}
