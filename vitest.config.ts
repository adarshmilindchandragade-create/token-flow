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
        'src/extension.ts',                                      // VS Code host — integration tested
        'src/features/workspace/workspaceReader.ts',             // VS Code APIs
        'src/features/workspace/gitIntegration.ts',             // VS Code Git API
        'src/features/tokenMonitor/tokenMonitorPanel.ts',        // Webview
        'src/features/storage/sessionStats.ts',                  // File I/O
        'src/features/statusBar/tokenStatusBar.ts',              // VS Code UI
        'src/shared/utils/logger.ts',                            // VS Code output channel
        // Provider implementations — network I/O, require real API keys
        'src/providers/anthropic/AnthropicProvider.ts',
        'src/providers/openrouter/OpenRouterProvider.ts',
        'src/providers/ollama/OllamaProvider.ts',
        'src/providers/openai/OpenAIProvider.ts',
        'src/providers/gemini/GeminiProvider.ts',
        'src/providers/registry/ProviderRegistry.ts',
        'src/providers/factory/ProviderFactory.ts',
      ],
    },
  },
});
