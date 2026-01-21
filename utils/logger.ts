/**
 * Centralized logging utility
 * Provides consistent logging across the app with environment-aware behavior
 */

// __DEV__ is a global variable in React Native
declare const __DEV__: boolean;

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: Date;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 100; // Keep last 100 logs in memory

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Log a debug message (only in development)
   */
  debug(message: string, ...data: unknown[]): void {
    if (__DEV__) {
      this.log(LogLevel.DEBUG, message, data);
      console.log(`[DEBUG] ${message}`, ...data);
    }
  }

  /**
   * Log an informational message (only in development)
   */
  info(message: string, ...data: unknown[]): void {
    if (__DEV__) {
      this.log(LogLevel.INFO, message, data);
      console.log(`[INFO] ${message}`, ...data);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...data: unknown[]): void {
    this.log(LogLevel.WARN, message, data);
    console.warn(`[WARN] ${message}`, ...data);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: unknown): void {
    this.log(LogLevel.ERROR, message, error);
    console.error(`[ERROR] ${message}`, error);

    // TODO: Send to crash reporting service (Sentry, Bugsnag, Firebase Crashlytics)
    // Example: Sentry.captureException(error, { extra: { message } });
  }

  /**
   * Store log entry in memory
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      level,
      message,
      data: data && data.length > 0 ? data : undefined,
      timestamp: new Date(),
    };

    this.logs.push(entry);

    // Keep only the last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  /**
   * Get recent logs (useful for debugging or sending to support)
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Clear all stored logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs as JSON string (for debugging or support)
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Convenience exports
export const debug = logger.debug.bind(logger);
export const info = logger.info.bind(logger);
export const warn = logger.warn.bind(logger);
export const error = logger.error.bind(logger);
