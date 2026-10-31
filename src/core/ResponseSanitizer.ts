import { isSealedValue } from "../security/CryptoVault.js";
import type { Doc } from "../data/Repository.js";

/** Fields that can never reach a client, whatever `hiddenFields` says. */
const ALWAYS_SECRET = ["password", "tokenHash", "codeHash", "resetTokenHash"] as const;
/** Anything that looks like one of Forge's password hashes is dropped wherever it appears. */
const HASH_PREFIX = "$argon2";
/** Hidden unless a route opts back in with `"!field"`. */
const HIDDEN_BY_DEFAULT = ["__v"] as const;

export interface SanitizeOptions {
  /** `Route.config.hiddenFields`. */
  hiddenFields?: readonly string[] | undefined;
  /** Encrypted fields that were decrypted for this response (their plain value is set by the caller). */
  decrypted?: readonly string[] | undefined;
}

/** Removes everything a client must not see from documents. Never mutates its input. */
export class ResponseSanitizer {
  private readonly secrets: Set<string>;

  constructor(extraSecrets: readonly string[] = []) {
    this.secrets = new Set<string>([...ALWAYS_SECRET, ...extraSecrets]);
  }

  /** Register fields that must never be returned (e.g. `select: false` fields, hashed fields). */
  addSecrets(fields: readonly string[]): void {
    for (const field of fields) this.secrets.add(field);
  }

  one(doc: Doc, options: SanitizeOptions = {}): Record<string, unknown> {
    const hidden = new Set<string>();
    const optedIn = new Set<string>();
    for (const entry of options.hiddenFields ?? []) {
      if (entry.startsWith("!")) optedIn.add(entry.slice(1));
      else hidden.add(entry);
    }
    for (const field of HIDDEN_BY_DEFAULT) if (!optedIn.has(field)) hidden.add(field);

    const result = this.strip(doc, 0) as Record<string, unknown>;
    for (const key of Object.keys(result)) {
      if (hidden.has(key) || (isSealedValue(result[key]) && !options.decrypted?.includes(key))) {
        delete result[key];
      }
    }
    return result;
  }

  many(docs: readonly Doc[], options: SanitizeOptions = {}): Record<string, unknown>[] {
    return docs.map((doc) => this.one(doc, options));
  }

  private strip(value: unknown, depth: number): unknown {
    if (depth > 8) return value;
    // Encrypted values inside nested objects (for example a populated document) are never decrypted, so they are dropped.
    // The fields of the document itself (depth 0) are handled by `one`, which knows which ones were decrypted.
    if (Array.isArray(value)) return value.filter((v) => !isSealedValue(v)).map((v) => this.strip(v, depth + 1));
    if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
      const out: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        if (this.secrets.has(key)) continue;
        if (typeof v === "string" && v.startsWith(HASH_PREFIX)) continue;
        if (depth > 0 && isSealedValue(v)) continue;
        out[key] = this.strip(v, depth + 1);
      }
      return out;
    }
    return value;
  }
}
