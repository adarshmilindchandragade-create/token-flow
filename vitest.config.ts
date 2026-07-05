import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Redirect 'vscode' imports to our mock — the real module only exists in the VS Code host
      vscode: path.resolve(__dirname, 'src/__mocks__/vscode.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/__mocks__/**',
        'src/extension.ts',                               // VS Code host — integration tested
        'src/features/workspace/workspaceReader.ts',      // VS Code APIs
        'src/features/workspace/gitIntegration.ts',       // VS Code Git API
        'src/features/tokenMonitor/tokenMonitorPanel.ts', // Webview
        'src/features/providers/AnthropicProvider.ts',    // Network
        'src/features/providers/ProviderRegistry.ts',     // VS Code config
        'src/features/storage/sessionStats.ts',           // File I/O
        'src/features/statusBar/tokenStatusBar.ts',       // VS Code UI
        'src/shared/utils/logger.ts',                     // VS Code output channel
      ],
    },
  },
});
