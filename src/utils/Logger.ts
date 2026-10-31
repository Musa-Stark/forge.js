export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

/** Where log lines go. Swap it to ship logs to pino, winston, a file... */
export interface LogSink {
  write(level: Exclude<LogLevel, "silent">, message: string, meta?: Record<string, unknown>): void;
}

export class ConsoleSink implements LogSink {
  write(level: Exclude<LogLevel, "silent">, message: string, meta?: Record<string, unknown>): void {
    const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
    const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    if (meta && Object.keys(meta).length > 0) out(line, meta);
    else out(line);
  }
}

/** Minimal levelled logger. Never logs secrets: callers pass only safe metadata. */
export class Logger {
  constructor(
    private readonly level: LogLevel = "info",
    private readonly sink: LogSink = new ConsoleSink(),
  ) {}

  static silent(): Logger {
    return new Logger("silent");
  }

  child(): Logger {
    return this;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log("debug", message, meta);
  }
  info(message: string, meta?: Record<string, unknown>): void {
    this.log("info", message, meta);
  }
  warn(message: string, meta?: Record<string, unknown>): void {
    this.log("warn", message, meta);
  }
  error(message: string, meta?: Record<string, unknown>): void {
    this.log("error", message, meta);
  }

  private log(level: Exclude<LogLevel, "silent">, message: string, meta?: Record<string, unknown>): void {
    if (ORDER[level] < ORDER[this.level]) return;
    this.sink.write(level, message, meta);
  }
}
