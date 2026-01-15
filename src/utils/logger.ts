/**
 * Structured logging utility for the Ambient Music app.
 *
 * Provides JSON-formatted logging with timestamps for better observability.
 * In development mode, logs are verbose. In production, only warnings and errors are logged.
 */

declare const __DEV__: boolean;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  [key: string]: unknown;
}

/**
 * Log a structured event with optional data.
 *
 * @param event - Event name (e.g., 'socket_connected', 'chunk_received')
 * @param data - Optional key-value data to include in the log
 * @param level - Log level (default: 'info')
 */
export function logEvent(
  event: string,
  data?: Record<string, unknown>,
  level: LogLevel = 'info'
): void {
  // In production, only log warnings and errors
  if (!__DEV__ && level !== 'warn' && level !== 'error') {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...data,
  };

  const logFn = getLogFunction(level);
  logFn(JSON.stringify(entry));
}

/**
 * Log a debug-level event (only in development).
 */
export function logDebug(event: string, data?: Record<string, unknown>): void {
  logEvent(event, data, 'debug');
}

/**
 * Log an info-level event.
 */
export function logInfo(event: string, data?: Record<string, unknown>): void {
  logEvent(event, data, 'info');
}

/**
 * Log a warning-level event.
 */
export function logWarn(event: string, data?: Record<string, unknown>): void {
  logEvent(event, data, 'warn');
}

/**
 * Log an error-level event.
 */
export function logError(event: string, data?: Record<string, unknown>): void {
  logEvent(event, data, 'error');
}

/**
 * Get the appropriate console function for a log level.
 */
function getLogFunction(level: LogLevel): typeof console.log {
  switch (level) {
    case 'debug':
      return console.debug;
    case 'info':
      return console.log;
    case 'warn':
      return console.warn;
    case 'error':
      return console.error;
    default:
      return console.log;
  }
}
