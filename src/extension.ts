// src/extension.ts — TokenFlow AI v1.1 Extension Entry Point
// Activated on 'onStartupFinished'. Registers all commands and wires the provider pipeline.

import * as vscode from 'vscode';
import { TokenMonitorPanel } from './features/tokenMonitor/tokenMonitorPanel';
import { TokenStatusBar } from './features/statusBar/tokenStatusBar';
import { SecretStorageService } from './features/storage/secretStorage';
import { SessionStatsService } from './features/storage/sessionStats';
import { ContextBuilder } from './features/context/contextBuilder';
import { TokenOptimizer } from './features/optimizer/tokenOptimizer';
import { BeforeAfterDiff } from './features/optimizer/beforeAfterDiff';
import { PreflightGuard } from './features/optimizer/preflightGuard';
import { PricingCatalog } from './providers/models/PricingCatalog';
import { Logger } from './shared/utils/logger';
import { isTokenFlowError } from './shared/errors/TokenFlowError';
import { ProviderRegistry } from './providers/registry/ProviderRegistry';
import { ProviderEventBus } from './shared/events/ProviderEventBus';
import { VSCodeSecretStore } from './features/settings/VSCodeSecretStore';
import { SettingsService } from './features/settings/SettingsService';
import {
  COMMAND_SHOW_MONITOR,
  COMMAND_SET_API_KEY,
  COMMAND_SEND_PROMPT,
  COMMAND_SHOW_BEFORE_AFTER,
  COMMAND_RESET_SESSION,
  COMMAND_SELECT_PROVIDER,
  COMMAND_SELECT_MODEL,
} from './shared/constants';

export function activate(context: vscode.ExtensionContext): void {
  const logger = Logger.getInstance();
  logger.info('TokenFlow AI v1.1 activating...');

  // ─── Infrastructure ───────────────────────────────────────────────────────
  const eventBus = new ProviderEventBus();
  const vscodeSecretStore = new VSCodeSecretStore(context.secrets);

  // Legacy SecretStorageService kept for SessionStatsService compatibility
  const secretStorage = new SecretStorageService(context.secrets);
  const sessionStats = new SessionStatsService(context.globalStorageUri);

  const providerRegistry = new ProviderRegistry(vscodeSecretStore, eventBus);
  const settingsService = new SettingsService(vscodeSecretStore, providerRegistry);

  const statusBar = new TokenStatusBar();
  const contextBuilder = new ContextBuilder();
  const optimizer = new TokenOptimizer();
  const diffBuilder = new BeforeAfterDiff();

  context.subscriptions.push(statusBar);

  // ─── Subscribe UI to provider events ─────────────────────────────────────
  // Status bar and token monitor react to events — they never call providers.
  eventBus.onCompleted((event) => {
    sessionStats.recordUsage(event.response.usage);
    const provider = providerRegistry.getActiveProvider();
    if (provider) statusBar.update(sessionStats.getStats(), provider.modelId);
    TokenMonitorPanel.update(sessionStats.getStats());
  });

  eventBus.onFailed(() => {
    statusBar.setError();
  });

  // ─── Hot-switch: re-initialize on settings change ─────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (
        e.affectsConfiguration('tokenflow.provider') ||
        e.affectsConfiguration('tokenflow.model') ||
        e.affectsConfiguration('tokenflow.openrouterModel') ||
        e.affectsConfiguration('tokenflow.ollamaModel')
      ) {
        logger.info('TokenFlow configuration changed — reinitializing provider...');
        const initialized = await providerRegistry.initialize();
        if (initialized) {
          const provider = providerRegistry.getActiveProvider();
          if (provider) statusBar.setProvider(provider.name, provider.modelId);
        }
      }
    }),
  );

  // ─── Command: Show Token Monitor ──────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_SHOW_MONITOR, () => {
      TokenMonitorPanel.createOrShow(context.extensionUri, sessionStats);
    }),
  );

  // ─── Command: Select Provider (quick-pick) ────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_SELECT_PROVIDER, async () => {
      await settingsService.selectProvider();
    }),
  );

  // ─── Command: Select Model (quick-pick) ───────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_SELECT_MODEL, async () => {
      await settingsService.selectModel();
    }),
  );

  // ─── Command: Set API Key (delegates to SettingsService) ─────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_SET_API_KEY, async () => {
      await settingsService.setApiKeyFor();
      const provider = providerRegistry.getActiveProvider();
      if (provider) statusBar.setProvider(provider.name, provider.modelId);
    }),
  );

  // ─── Command: Send Optimized Prompt ───────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_SEND_PROMPT, async () => {
      const userPrompt = await vscode.window.showInputBox({
        title: 'TokenFlow AI — Send Optimized Prompt',
        prompt: 'Enter your prompt. TokenFlow will optimize context before sending to the AI.',
        placeHolder: 'What does this function do?',
      });

      if (!userPrompt) return;

      try {
        const provider = providerRegistry.requireActiveProvider();

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `TokenFlow: Building context for ${provider.name}/${provider.modelId}...`,
            cancellable: false,
          },
          async () => {
            const rawContext = await contextBuilder.buildContext();
            const optimized = await optimizer.optimize(rawContext);

            // ─── Preflight guardrails ────────────────────────────────────
            const preflightConfig = vscode.workspace.getConfiguration('tokenflow');
            const maxContextTokens = preflightConfig.get<number>('maxContextTokens', 0);
            const softBudgetUsd = preflightConfig.get<number>('softBudgetUsd', 0);
            const hardBudgetUsd = preflightConfig.get<number>('hardBudgetUsd', 0);
            const assumedOutputTokens = preflightConfig.get<number>('assumedOutputTokensForBudget', 500);

            // Rule 1 — token ceiling (informational; content already truncated by optimizer)
            const tokenCheck = PreflightGuard.checkTokenCeiling(
              optimized.optimizedTokenCount,
              maxContextTokens,
            );
            if (!tokenCheck.pass) {
              void vscode.window.showWarningMessage(`TokenFlow: ${tokenCheck.message}`);
            }

            // Rule 2 — cost budget (may block or warn before API call)
            const estimatedCost = PricingCatalog.estimateCost(
              provider.modelId,
              optimized.optimizedTokenCount,
              assumedOutputTokens, // assumed output; real count unknown pre-send (ADR-006)
            );
            const costCheck = PreflightGuard.checkCostBudget(
              estimatedCost,
              softBudgetUsd,
              hardBudgetUsd,
            );
            if (!costCheck.pass) {
              if (costCheck.hardBlock) {
                void vscode.window.showErrorMessage(`TokenFlow: ${costCheck.message}`);
                return; // abort send
              }
              // Soft block: offer "Send anyway"
              const action = await vscode.window.showWarningMessage(
                `TokenFlow: ${costCheck.message}`,
                'Send anyway',
                'Cancel',
              );
              if (action !== 'Send anyway') return;
            }
            // ─────────────────────────────────────────────────────────────

            // MetricsMiddleware automatically fires events to eventBus
            // which updates sessionStats + statusBar + TokenMonitorPanel
            const response = await provider.send({
              systemPrompt: [
                'You are a helpful coding assistant.',
                '',
                '## Workspace Context',
                optimized.optimizedContent,
              ].join('\n'),
              messages: [{ role: 'user', content: userPrompt }],
            });

            // Show response in a side panel
            const doc = await vscode.workspace.openTextDocument({
              content: response.content,
              language: 'markdown',
            });
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

            // Show optimization savings
            const report = diffBuilder.buildReport(optimized);
            // Wire the savings bar in the token monitor panel (Bug #1 fix)
            TokenMonitorPanel.updateSavings(report.savedTokens, report.rawTokenCount, report.savingsPercent);
            void vscode.window
              .showInformationMessage(
                `⚡ TokenFlow: ${report.savedTokens.toLocaleString()} tokens saved (${report.savingsPercent}%) · ` +
                  `Cost: ${
                    response.usage.estimatedCostUsd < 0.001
                      ? '<$0.001'
                      : `$${response.usage.estimatedCostUsd.toFixed(4)}`
                  }`,
                'Show Monitor',
              )
              .then((action) => {
                if (action === 'Show Monitor') {
                  TokenMonitorPanel.createOrShow(context.extensionUri, sessionStats);
                }
              });
          },
        );
      } catch (err) {
        const message = isTokenFlowError(err) ? err.message : `Unexpected error: ${String(err)}`;
        void vscode.window.showErrorMessage(`TokenFlow: ${message}`);
        statusBar.setError();
        logger.error('Send prompt failed', err instanceof Error ? err : undefined);
      }
    }),
  );

  // ─── Command: Show Before/After Comparison ────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_SHOW_BEFORE_AFTER, async () => {
      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'TokenFlow: Analyzing context...',
            cancellable: false,
          },
          async () => {
            const rawContext = await contextBuilder.buildContext();
            const optimized = await optimizer.optimize(rawContext);
            const report = diffBuilder.buildReport(optimized);

            // Wire the savings bar in the token monitor panel (Bug #1 fix)
            TokenMonitorPanel.updateSavings(report.savedTokens, report.rawTokenCount, report.savingsPercent);

            const content = [
              '# TokenFlow AI — Before/After Comparison',
              '',
              '## Summary',
              '```',
              report.summary,
              '```',
              '',
              '## Context Breakdown',
              '```',
              report.breakdownLines.join('\n'),
              '```',
              '',
              '## Optimized Context',
              '> This is what will be sent to the model:',
              '',
              report.optimizedContent,
            ].join('\n');

            const doc = await vscode.workspace.openTextDocument({
              content,
              language: 'markdown',
            });
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
          },
        );
      } catch (err) {
        const message = isTokenFlowError(err) ? err.message : String(err);
        void vscode.window.showErrorMessage(`TokenFlow: ${message}`);
      }
    }),
  );

  // ─── Command: Reset Session ───────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_RESET_SESSION, () => {
      sessionStats.resetSession();
      statusBar.setIdle();
      const provider = providerRegistry.getActiveProvider();
      if (provider) statusBar.setProvider(provider.name, provider.modelId);
      TokenMonitorPanel.update(sessionStats.getStats());
      void vscode.window.showInformationMessage('TokenFlow: Session stats reset.');
    }),
  );

  // ─── Auto-initialize provider on activation ───────────────────────────────
  void providerRegistry
    .initialize()
    .then((initialized) => {
      if (initialized) {
        const provider = providerRegistry.getActiveProvider();
        if (provider) {
          statusBar.setProvider(provider.name, provider.modelId);
          logger.info(`Provider ready: ${provider.name} / ${provider.modelId}`);
        }
      } else {
        logger.info(
          'No provider configured. Run "TokenFlow: Select Provider" or "TokenFlow: Set API Key".',
        );
      }
    })
    .catch((err: Error) => {
      logger.error('Provider auto-initialization failed', err);
    });

  // Suppress unused import lint warning (secretStorage used by SessionStatsService)
  void secretStorage;

  logger.info('TokenFlow AI v1.1 activated successfully.');
}

export function deactivate(): void {
  Logger.getInstance().info('TokenFlow AI deactivating.');
  Logger.getInstance().dispose();
}
