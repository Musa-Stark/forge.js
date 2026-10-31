import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 (the encoding authenticator apps expect for secrets). */
export const base32 = {
  encode(bytes: Uint8Array): string {
    let bits = 0;
    let value = 0;
    let out = "";
    for (const byte of bytes) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        out += ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
    return out;
  },

  decode(text: string): Buffer {
    const clean = text.replace(/[\s=-]/g, "").toUpperCase();
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const char of clean) {
      const index = ALPHABET.indexOf(char);
      if (index === -1) throw new Error("Invalid base32 character");
      value = (value << 5) | index;
      bits += 5;
      if (bits >= 8) {
        out.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return Buffer.from(out);
  },
};

export interface TotpOptions {
  /** Code length. @default 6 */
  digits?: number;
  /** Seconds per code. @default 30 */
  period?: number;
  /** Accepted clock drift in steps either side of "now". @default 1 */
  window?: number;
}

/**
 * Time-based one-time passwords (RFC 6238, HMAC-SHA1) - what Google Authenticator, Authy,
 * 1Password and friends generate.
 */
export class Totp {
  readonly digits: number;
  readonly period: number;
  readonly window: number;

  constructor(options: TotpOptions = {}) {
    this.digits = options.digits ?? 6;
    this.period = options.period ?? 30;
    this.window = options.window ?? 1;
  }

  /** A fresh 160-bit secret, base32 encoded. */
  static generateSecret(bytes = 20): string {
    return base32.encode(randomBytes(bytes));
  }

  /** The time step a moment falls in. */
  stepAt(timeMs: number): number {
    return Math.floor(timeMs / 1000 / this.period);
  }

  /** The code an authenticator app shows at `timeMs`. */
  codeAt(secret: string, timeMs: number = Date.now()): string {
    return this.hotp(base32.decode(secret), this.stepAt(timeMs));
  }

  /**
   * Checks a user-supplied code against the steps around now.
   * Returns the matching step (store it, and pass it as `afterStep` next time so a code can never be
   * used twice), or `undefined`. Every candidate is compared in constant time with no early exit.
   */
  verify(secret: string, code: string, options: { now?: number; afterStep?: number } = {}): number | undefined {
    const candidate = code.replace(/\s/g, "");
    if (!new RegExp(`^\\d{${this.digits}}$`).test(candidate)) return undefined;

    const key = base32.decode(secret);
    const current = this.stepAt(options.now ?? Date.now());
    const given = Buffer.from(candidate);
    let matched: number | undefined;

    for (let step = current - this.window; step <= current + this.window; step++) {
      if (step < 0) continue;
      const equal = timingSafeEqual(given, Buffer.from(this.hotp(key, step)));
      if (equal && step > (options.afterStep ?? -1)) matched = step;
    }
    return matched;
  }

  /** The `otpauth://` URI that QR codes encode. */
  otpauthUrl(input: { secret: string; issuer: string; account: string }): string {
    const label = `${encodeURIComponent(input.issuer)}:${encodeURIComponent(input.account)}`;
    const query = new URLSearchParams({
      secret: input.secret,
      issuer: input.issuer,
      algorithm: "SHA1",
      digits: String(this.digits),
      period: String(this.period),
    });
    return `otpauth://totp/${label}?${query.toString()}`;
  }

  private hotp(key: Buffer, counter: number): string {
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(counter));
    const hash = createHmac("sha1", key).update(message).digest();
    const offset = (hash[hash.length - 1] as number) & 0x0f;
    const binary =
      (((hash[offset] as number) & 0x7f) << 24) |
      (((hash[offset + 1] as number) & 0xff) << 16) |
      (((hash[offset + 2] as number) & 0xff) << 8) |
      ((hash[offset + 3] as number) & 0xff);
    return (binary % 10 ** this.digits).toString().padStart(this.digits, "0");
  }
}
