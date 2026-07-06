// src/features/tokenMonitor/tokenMonitorPanel.ts — VS Code Webview panel

import * as vscode from 'vscode';
import type { SessionTokenUsage } from '../../core/domain/entities/TokenUsage';
import type { SessionStatsService } from '../storage/sessionStats';

/**
 * Manages the Token Monitor webview panel lifecycle.
 * Singleton pattern — only one panel can be open at a time.
 *
 * Messages:
 *   Extension → Webview:  { command: 'update', stats: SessionTokenUsage }
 *   Webview → Extension:  { command: 'refresh' }
 */
export class TokenMonitorPanel {
  static currentPanel: TokenMonitorPanel | undefined;
  static readonly viewType = 'tokenflowMonitor';

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];

  // ─── Factory ─────────────────────────────────────────────────────────────

  static createOrShow(extensionUri: vscode.Uri, sessionStats: SessionStatsService): void {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (TokenMonitorPanel.currentPanel) {
      TokenMonitorPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      TokenMonitorPanel.viewType,
      'TokenFlow Monitor',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      },
    );

    TokenMonitorPanel.currentPanel = new TokenMonitorPanel(panel, extensionUri, sessionStats);
  }

  /** Push a stats update to the webview. Called after every provider response. */
  static update(stats: SessionTokenUsage): void {
    TokenMonitorPanel.currentPanel?.sendStats(stats);
  }

  /**
   * Push optimizer savings data to the webview.
   * Triggers the `savings-section` bar that has been listening for this
   * command since v1.0 but was never called (Bug #1).
   */
  static updateSavings(savedTokens: number, rawTokenCount: number, savingsPercent: number): void {
    void TokenMonitorPanel.currentPanel?.panel.webview.postMessage({
      command: 'savings',
      savedTokens,
      rawTokenCount,
      savingsPercent,
    });
  }

  // ─── Constructor ─────────────────────────────────────────────────────────

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private readonly sessionStats: SessionStatsService,
  ) {
    this.panel = panel;
    this.panel.webview.html = this.buildHtml(extensionUri);

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (msg: { command: string }) => {
        if (msg.command === 'refresh') {
          this.sendStats(this.sessionStats.getStats());
        }
      },
      null,
      this.disposables,
    );

    // Send initial data
    this.sendStats(this.sessionStats.getStats());
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private sendStats(stats: SessionTokenUsage): void {
    void this.panel.webview.postMessage({ command: 'update', stats });
  }

  private buildHtml(extensionUri: vscode.Uri): string {
    const webview = this.panel.webview;
    const mediaUri = vscode.Uri.joinPath(extensionUri, 'media', 'tokenMonitor');
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'style.css'));
    const nonce = generateNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${webview.cspSource};
             script-src 'nonce-${nonce}';">
  <link href="${styleUri.toString()}" rel="stylesheet">
  <title>TokenFlow Monitor</title>
</head>
<body>
  <div id="app">
    <header>
      <h1>⚡ TokenFlow Monitor</h1>
      <p class="subtitle">Real-time token usage &amp; cost tracking</p>
    </header>

    <main>
      <section class="stat-grid">
        <div class="stat-card">
          <span class="stat-label">Input Tokens</span>
          <span class="stat-value" id="input-tokens">—</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Output Tokens</span>
          <span class="stat-value" id="output-tokens">—</span>
        </div>
        <div class="stat-card highlight">
          <span class="stat-label">Session Cost</span>
          <span class="stat-value" id="session-cost">—</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Requests</span>
          <span class="stat-value" id="request-count">0</span>
        </div>
      </section>

      <section id="savings-section" class="hidden">
        <h2>Last Optimization</h2>
        <div class="savings-bar-container">
          <div class="savings-bar-fill" id="savings-fill" style="width: 0%"></div>
        </div>
        <p id="savings-text"></p>
      </section>
    </main>

    <footer>
      <button id="refresh-btn" type="button">↻ Refresh</button>
    </footer>
  </div>
  <script nonce="${nonce}" src="${scriptUri.toString()}"></script>
</body>
</html>`;
  }

  dispose(): void {
    TokenMonitorPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
