/**
 * Simple logging utility for Edge Functions.
 * Provides structured logging with different log levels.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    context?: Record<string, unknown>;
}

/**
 * Creates a log entry with timestamp and optional context.
 */
function createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
): LogEntry {
    return {
        level,
        message,
        timestamp: new Date().toISOString(),
        context,
    };
}

/**
 * Logs a message with the specified level.
 */
function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry = createLogEntry(level, message, context);
    const output = JSON.stringify(entry);

    switch (level) {
        case 'debug':
            console.debug(output);
            break;
        case 'info':
            console.info(output);
            break;
        case 'warn':
            console.warn(output);
            break;
        case 'error':
            console.error(output);
            break;
    }
}

/**
 * Logger object with methods for each log level.
 */
export const logger = {
    /**
     * Logs a debug message. Use for detailed debugging information.
     */
    debug: (message: string, context?: Record<string, unknown>): void => {
        log('debug', message, context);
    },

    /**
     * Logs an info message. Use for general operational information.
     */
    info: (message: string, context?: Record<string, unknown>): void => {
        log('info', message, context);
    },

    /**
     * Logs a warning message. Use for potentially problematic situations.
     */
    warn: (message: string, context?: Record<string, unknown>): void => {
        log('warn', message, context);
    },

    /**
     * Logs an error message. Use for error conditions.
     */
    error: (message: string, context?: Record<string, unknown>): void => {
        log('error', message, context);
    },
};
