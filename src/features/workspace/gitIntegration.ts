// src/features/workspace/gitIntegration.ts — VS Code Git Extension API wrapper
// Never shells out to the `git` binary — uses the built-in vscode.git extension API.

import * as vscode from 'vscode';
import { Logger } from '../../shared/utils/logger';
import { TokenFlowError, TokenFlowErrorCode } from '../../shared/errors/TokenFlowError';

export interface GitDiffResult {
  /** Raw unified-format git diff text. Empty string if no changes or no git repo. */
  diff: string;
  /** Absolute paths of all files reported as modified (working tree + index). */
  changedFiles: string[];
}

// VS Code Git Extension API shape (subset we actually use)
interface GitAPI {
  repositories: GitRepository[];
}

interface GitRepository {
  state: {
    workingTreeChanges: GitChange[];
    indexChanges: GitChange[];
  };
  diff(includeIndex: boolean): Promise<string>;
}

interface GitChange {
  uri: vscode.Uri;
}

/**
 * Wraps the VS Code built-in Git extension API.
 * Provides safe access to git diff data without spawning child processes.
 */
export class GitIntegration {
  private readonly logger = Logger.getInstance();

  /**
   * Returns diff text and list of changed file paths from the active repository.
   * Gracefully returns empty results if git is unavailable or the workspace is not a repo.
   */
  async getDiff(): Promise<GitDiffResult> {
    const api = this.getGitAPI();
    if (!api) {
      return { diff: '', changedFiles: [] };
    }

    const repos = api.repositories;
    if (repos.length === 0) {
      this.logger.debug('No git repositories found in workspace.');
      return { diff: '', changedFiles: [] };
    }

    const repo = repos[0]; // Primary repository

    const changedFiles: string[] = [
      ...repo.state.workingTreeChanges.map((c) => c.uri.fsPath),
      ...repo.state.indexChanges.map((c) => c.uri.fsPath),
    ];

    // Deduplicate (a file can appear in both working tree and index)
    const uniqueChangedFiles = [...new Set(changedFiles)];

    let diff = '';
    try {
      diff = await repo.diff(false); // false = unstaged diff
    } catch (err) {
      this.logger.warn(`Could not retrieve git diff: ${String(err)}`);
    }

    return { diff, changedFiles: uniqueChangedFiles };
  }

  /** Returns true if the VS Code Git extension is installed and active. */
  isAvailable(): boolean {
    return this.getGitAPI() !== null;
  }

  private getGitAPI(): GitAPI | null {
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (!gitExtension?.isActive) {
      if (!gitExtension) {
        throw new TokenFlowError(
          'VS Code Git extension not found. Ensure Git is installed.',
          TokenFlowErrorCode.GIT_NOT_AVAILABLE,
        );
      }
      // Extension exists but not yet active — return null (caller handles gracefully)
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return (gitExtension.exports as { getAPI: (v: number) => GitAPI }).getAPI(1);
  }
}
