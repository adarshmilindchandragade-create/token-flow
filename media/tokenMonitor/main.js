// media/tokenMonitor/main.js — Webview-side JavaScript for the Token Monitor panel
// Runs inside the VS Code webview sandbox (no Node.js APIs available).
// Communicates with the extension host via the VS Code webview message API.

(function () {
  'use strict';

  // acquireVsCodeApi() is injected by VS Code into the webview context
  const vscode = acquireVsCodeApi();

  // ─── DOM elements ───────────────────────────────────────────────────────
  const inputTokensEl = document.getElementById('input-tokens');
  const outputTokensEl = document.getElementById('output-tokens');
  const sessionCostEl = document.getElementById('session-cost');
  const requestCountEl = document.getElementById('request-count');
  const savingsSection = document.getElementById('savings-section');
  const savingsFill = document.getElementById('savings-fill');
  const savingsText = document.getElementById('savings-text');
  const refreshBtn = document.getElementById('refresh-btn');

  // ─── Message handler ────────────────────────────────────────────────────
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.command === 'update') {
      renderStats(message.stats);
    }
    if (message.command === 'savings') {
      renderSavings(message.savedTokens, message.rawTokenCount, message.savingsPercent);
    }
  });

  // ─── Refresh button ─────────────────────────────────────────────────────
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      vscode.postMessage({ command: 'refresh' });
    });
  }

  // ─── Render functions ────────────────────────────────────────────────────
  function renderStats(stats) {
    if (!stats) return;
    setText(inputTokensEl, formatNumber(stats.totalInputTokens));
    setText(outputTokensEl, formatNumber(stats.totalOutputTokens));
    setText(sessionCostEl, formatCost(stats.totalCostUsd));
    setText(requestCountEl, String(stats.requestCount));
  }

  function renderSavings(savedTokens, rawTokenCount, savingsPercent) {
    if (!savingsSection || savedTokens === 0) return;

    savingsSection.classList.remove('hidden');

    if (savingsFill) {
      savingsFill.style.width = `${Math.min(savingsPercent, 100)}%`;
    }

    if (savingsText) {
      savingsText.textContent =
        `${formatNumber(savedTokens)} tokens saved (${savingsPercent}%) from ${formatNumber(rawTokenCount)} raw`;
    }
  }

  // ─── Utilities ───────────────────────────────────────────────────────────
  function setText(el, value) {
    if (el) el.textContent = value;
  }

  function formatNumber(n) {
    if (typeof n !== 'number') return '—';
    return n.toLocaleString();
  }

  function formatCost(cost) {
    if (typeof cost !== 'number') return '—';
    if (cost === 0) return '$0.00';
    if (cost < 0.001) return '<$0.001';
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(3)}`;
  }

  // ─── Request initial data on load ────────────────────────────────────────
  vscode.postMessage({ command: 'refresh' });
})();
