// src/__mocks__/vscode.ts — Minimal vscode API mock for Vitest unit tests
// Provides just enough surface to satisfy imports in pure-logic modules.

export const window = {
  activeTextEditor: null,
  createOutputChannel: () => ({
    appendLine: () => {},
    show: () => {},
    dispose: () => {},
  }),
  createStatusBarItem: () => ({
    text: '',
    tooltip: '',
    command: '',
    show: () => {},
    dispose: () => {},
  }),
  showInformationMessage: () => Promise.resolve(undefined),
  showErrorMessage: () => Promise.resolve(undefined),
  showWarningMessage: () => Promise.resolve(undefined),
  showInputBox: () => Promise.resolve(undefined),
  withProgress: (_opts: unknown, task: () => Promise<void>) => task(),
};

export const workspace = {
  workspaceFolders: undefined,
  getConfiguration: (_section?: string) => ({
    get: (_key: string, defaultValue?: unknown) => defaultValue,
  }),
  openTextDocument: () => Promise.resolve({}),
};

export const commands = {
  registerCommand: (_cmd: string, _handler: unknown) => ({ dispose: () => {} }),
};

export const extensions = {
  getExtension: (_id: string) => undefined,
};

export const Uri = {
  joinPath: (..._args: unknown[]) => ({ fsPath: '', toString: () => '' }),
  file: (_path: string) => ({ fsPath: _path, toString: () => _path }),
};

export const ViewColumn = { One: 1, Beside: 2 };
export const ProgressLocation = { Notification: 15 };
export const StatusBarAlignment = { Right: 2, Left: 1 };
export const ThemeColor = class ThemeColor { constructor(public id: string) {} };
export const MarkdownString = class MarkdownString { constructor(public value: string) {} };

export class Disposable {
  constructor(private callOnDispose: () => void) {}
  dispose() { this.callOnDispose(); }
}

export const SecretStorage = {};
