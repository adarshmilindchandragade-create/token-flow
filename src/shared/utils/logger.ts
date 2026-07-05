// src/shared/utils/logger.ts — VS Code OutputChannel singleton logger

import * as vscode from 'vscode';
import { EXTENSION_NAME } from '../constants';

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

/**
 * Singleton logger that writes to a named VS Code OutputChannel.
 * DEBUG messages are only emitted when TOKENFLOW_DEBUG env var is set.
 */
export class Logger {
  private static instance: Logger | undefined;
  private readonly outputChannel: vscode.OutputChannel;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel(EXTENSION_NAME);
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  info(message: string): void {
    this.log('INFO', message);
  }

  warn(message: string): void {
    this.log('WARN', message);
  }

  error(message: string, error?: Error): void {
    this.log('ERROR', message);
    if (error?.stack) {
      this.outputChannel.appendLine(`  Stack: ${error.stack}`);
    }
  }

  debug(message: string): void {
    if (process.env['TOKENFLOW_DEBUG']) {
      this.log('DEBUG', message);
    }
  }

  /** Bring the output channel into focus. */
  show(): void {
    this.outputChannel.show(true);
  }

  /** Must be called on extension deactivation to free resources. */
  dispose(): void {
    this.outputChannel.dispose();
    Logger.instance = undefined;
  }

  private log(level: LogLevel, message: string): void {
    const ts = new Date().toISOString();
    this.outputChannel.appendLine(`[${ts}] [${level}] ${message}`);
  }
}
