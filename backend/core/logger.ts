/**
 * AEGIS-X Backend — Structured Logger
 * JSON structured logging with trace IDs, PII masking, severity levels.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  traceId?: string;
  incidentId?: string;
  agentRole?: string;
  durationMs?: number;
  error?: string;
  meta?: Record<string, unknown>;
}

const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // email
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\bpassword[=:\s]+\S+/gi, // passwords
  /\btoken[=:\s]+\S+/gi, // tokens
  /\bapi[_-]?key[=:\s]+\S+/gi, // API keys
  /\bsecret[=:\s]+\S+/gi, // secrets
];

function maskPII(message: string): string {
  let masked = message;
  for (const pattern of PII_PATTERNS) {
    masked = masked.replace(pattern, '[REDACTED]');
  }
  return masked;
}

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE_KEYS = new Set(['password', 'token', 'apiKey', 'secret', 'key', 'credential', 'auth']);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      result[k] = '[REDACTED]';
    } else if (typeof v === 'string') {
      result[k] = maskPII(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

class AegisLogger {
  private component: string;
  private minLevel: LogLevel;

  private readonly LEVELS: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  };

  constructor(component: string, minLevel: LogLevel = 'INFO') {
    this.component = component;
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.LEVELS[level] >= this.LEVELS[this.minLevel];
  }

  private write(level: LogLevel, message: string, meta?: Partial<LogEntry>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message: maskPII(message),
      ...meta,
      meta: meta?.meta ? sanitizeMeta(meta.meta) : undefined,
    };

    const output = JSON.stringify(entry);

    if (level === 'ERROR') {
      console.error(output);
    } else if (level === 'WARN') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  debug(message: string, meta?: Partial<LogEntry>): void {
    this.write('DEBUG', message, meta);
  }

  info(message: string, meta?: Partial<LogEntry>): void {
    this.write('INFO', message, meta);
  }

  warn(message: string, meta?: Partial<LogEntry>): void {
    this.write('WARN', message, meta);
  }

  error(message: string, error?: unknown, meta?: Partial<LogEntry>): void {
    const errorStr = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '');
    this.write('ERROR', message, { ...meta, error: errorStr });
  }

  child(component: string): AegisLogger {
    return new AegisLogger(`${this.component}:${component}`, this.minLevel);
  }
}

// Factory
const loggers = new Map<string, AegisLogger>();

export function getLogger(component: string): AegisLogger {
  if (!loggers.has(component)) {
    const level: LogLevel =
      process.env.LOG_LEVEL === 'debug' ? 'DEBUG' :
      process.env.LOG_LEVEL === 'warn' ? 'WARN' : 'INFO';
    loggers.set(component, new AegisLogger(component, level));
  }
  return loggers.get(component)!;
}

export const rootLogger = getLogger('aegis-x');
