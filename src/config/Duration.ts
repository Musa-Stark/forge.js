import { ConfigurationError, ErrorCode } from "../errors/index.js";

export type DurationUnit = "ms" | "s" | "m" | "h" | "d" | "w" | "mo" | "y";

/** A human-readable duration such as `"15m"`, `"1d"` or `"2w"`. */
export type DurationType = `${number}${DurationUnit}`;

const UNIT_MS: Record<DurationUnit, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
  mo: 2_592_000_000, // 30 days
  y: 31_536_000_000, // 365 days
};

const PATTERN = /^(\d+(?:\.\d+)?)(ms|s|m|h|d|w|mo|y)$/;

/**
 * Immutable time span.
 *
 * Replaces the 1.x lookup table, which could only express a fixed set of
 * values and mapped `"0s"` to one second.
 */
export class Duration {
  private constructor(private readonly milliseconds: number) {}

  static ofMs(ms: number): Duration {
    if (!Number.isFinite(ms) || ms < 0) {
      throw new ConfigurationError({
        message: `Invalid duration: ${ms}`,
        code: ErrorCode.CONFIGURATION_ERROR,
      });
    }
    return new Duration(Math.round(ms));
  }

  static parse(input: DurationType | string | number | Duration): Duration {
    if (input instanceof Duration) return input;
    if (typeof input === "number") return Duration.ofMs(input);

    const match = PATTERN.exec(input.trim());
    if (!match) {
      throw new ConfigurationError({
        message: `Invalid duration "${input}".`,
        hint: 'Write durations like "30s", "15m", "1h", "7d", "2w", "1mo" or "1y".',
      });
    }
    const [, amount, unit] = match;
    return Duration.ofMs(Number(amount) * UNIT_MS[unit as DurationUnit]);
  }

  toMs(): number {
    return this.milliseconds;
  }

  toSeconds(): number {
    return Math.floor(this.milliseconds / 1000);
  }

  isZero(): boolean {
    return this.milliseconds === 0;
  }

  /** The point in time this duration from `from` (default: now). */
  fromNow(from: number | Date = Date.now()): Date {
    const base = typeof from === "number" ? from : from.getTime();
    return new Date(base + this.milliseconds);
  }
}
