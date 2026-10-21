/**
 * Centralized, dependency-free logging for every extension context (M4.T3a).
 *
 * The logger is deliberately small: it filters by level, prefixes every record
 * with a stable scope and forwards structured details to an injectable sink.
 * It has no transport of its own — no remote logging, no persistence — and
 * callers must keep the context technical (message type, storage key, export
 * format), never user data such as URLs, domains or message payloads.
 */

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** Technical fields attached to a log record. Never put user data here. */
export type LogContext = Readonly<Record<string, unknown>>;

export interface LogRecord {
  readonly level: LogLevel;
  readonly scope: string;
  readonly message: string;
  /** Normalized cause (for `error`) and/or context, in that order. */
  readonly details: readonly unknown[];
}

/** Destination of a log record. Injected in tests; defaults to `console`. */
export type LogSink = (record: LogRecord) => void;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  /** `cause` is normalized to an `Error` when it is not one already. */
  error(message: string, cause?: unknown, context?: LogContext): void;
  /** Derive a logger whose scope is appended to this one (`background:dnr`). */
  child(scope: string): Logger;
}

export interface LoggerOptions {
  readonly sink?: LogSink;
  /** Records below this level are discarded. Defaults to `debug` in dev, `warn` in production. */
  readonly minLevel?: LogLevel;
}

const LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function defaultMinLevel(): LogLevel {
  return import.meta.env.DEV ? 'debug' : 'warn';
}

function prefix(record: LogRecord): string {
  return `[buildit:${record.scope}] ${record.message}`;
}

/**
 * Default sink: the browser console. Kept private so callers depend on the
 * `LogSink` contract rather than on a concrete console implementation.
 */
const consoleSink: LogSink = (record) => {
  const message = prefix(record);

  switch (record.level) {
    case 'debug':
      console.debug(message, ...record.details);
      break;
    case 'info':
      console.info(message, ...record.details);
      break;
    case 'warn':
      console.warn(message, ...record.details);
      break;
    case 'error':
      console.error(message, ...record.details);
      break;
  }
};

/**
 * Preserve the original `Error` (and therefore its stack). Non-`Error` values
 * are wrapped so a sink always receives a stack-bearing value.
 */
function normalizeCause(cause: unknown): Error {
  if (cause instanceof Error) {
    return cause;
  }

  if (typeof cause === 'string' && cause.trim() !== '') {
    return new Error(cause);
  }

  return new Error('Non-Error value logged', { cause });
}

/**
 * Create a scoped logger.
 *
 * The returned methods are arrow functions, so they can be passed around
 * without losing `this`. A failing sink is swallowed: logging is best-effort
 * and must never turn a handled error into a new one for the caller.
 */
export function createLogger(
  scope: string,
  options: LoggerOptions = {},
): Logger {
  const sink = options.sink ?? consoleSink;
  const minLevel = options.minLevel ?? defaultMinLevel();
  const minPriority = LEVEL_PRIORITY[minLevel];

  const isEnabled = (level: LogLevel): boolean =>
    LEVEL_PRIORITY[level] >= minPriority;

  const emit = (
    level: LogLevel,
    message: string,
    details: readonly unknown[],
  ): void => {
    try {
      sink({ level, scope, message, details });
    } catch {
      // Logging is best-effort: a broken sink must not break the caller.
    }
  };

  return {
    debug(message, context) {
      if (!isEnabled('debug')) return;
      emit('debug', message, context === undefined ? [] : [context]);
    },

    info(message, context) {
      if (!isEnabled('info')) return;
      emit('info', message, context === undefined ? [] : [context]);
    },

    warn(message, context) {
      if (!isEnabled('warn')) return;
      emit('warn', message, context === undefined ? [] : [context]);
    },

    error(message, cause, context) {
      if (!isEnabled('error')) return;

      const details: unknown[] = [];
      if (cause !== undefined) details.push(normalizeCause(cause));
      if (context !== undefined) details.push(context);

      emit('error', message, details);
    },

    child(childScope) {
      const trimmed = childScope.trim();
      return createLogger(trimmed === '' ? scope : `${scope}:${trimmed}`, {
        sink,
        minLevel,
      });
    },
  };
}
