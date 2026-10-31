import { ErrorCode, ValidationError } from "../errors/index.js";
import type { CryptoVault } from "../security/CryptoVault.js";
import { isSealedValue } from "../security/CryptoVault.js";
import type { PasswordHasher } from "../security/PasswordHasher.js";

export interface FieldSpec {
  name: string;
  optional: boolean;
}

/** `"ssn?"` -> `{ name: "ssn", optional: true }`. */
export const parseFieldSpec = (spec: string): FieldSpec =>
  spec.endsWith("?") ? { name: spec.slice(0, -1), optional: true } : { name: spec, optional: false };

/** Applies the per-route `encryptedFields`, `hashedFields` and `decryptedFields` rules. */
export class FieldTransformer {
  constructor(
    private readonly vault: CryptoVault,
    private readonly hasher: PasswordHasher,
  ) {}

  /** Replaces listed body fields with sealed values. Returns a new object. */
  async encrypt(body: Record<string, unknown>, specs: readonly string[] | undefined): Promise<Record<string, unknown>> {
    return this.transform(body, specs, async (value, name) => this.vault.seal(this.text(value, name)));
  }

  /** Replaces listed body fields with Argon2id hashes. Returns a new object. */
  async hash(body: Record<string, unknown>, specs: readonly string[] | undefined): Promise<Record<string, unknown>> {
    return this.transform(body, specs, async (value, name) => this.hasher.hash(this.text(value, name)));
  }

  /** Reads plain values of sealed fields from a stored document. */
  async decrypt(doc: Record<string, unknown>, specs: readonly string[] | undefined): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const spec of specs ?? []) {
      const { name, optional } = parseFieldSpec(spec);
      const stored = doc[name];
      if (stored === undefined || stored === null) {
        if (optional) continue;
        throw new ValidationError({ message: `'${name}' has no stored value to decrypt.`, code: ErrorCode.FIELD_MISSING });
      }
      if (!isSealedValue(stored)) continue;
      out[name] = await this.vault.unseal(stored);
    }
    return out;
  }

  private async transform(
    body: Record<string, unknown>,
    specs: readonly string[] | undefined,
    apply: (value: unknown, name: string) => Promise<unknown>,
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = { ...body };
    for (const spec of specs ?? []) {
      const { name, optional } = parseFieldSpec(spec);
      if (!Object.hasOwn(body, name) || body[name] === undefined) {
        if (optional) continue;
        throw new ValidationError({
          message: `'${name}' is required.`,
          code: ErrorCode.FIELD_MISSING,
          hint: `Add '${name}' to the route's validation, or mark it optional as '${name}?'.`,
        });
      }
      result[name] = await apply(body[name], name);
    }
    return result;
  }

  /** Only a non-empty string can be sealed or hashed. A blank value from a client is a 422, not a crash. */
  private text(value: unknown, name: string): string {
    if (typeof value !== "string") {
      throw new ValidationError({ message: `'${name}' must be a string.`, code: ErrorCode.VALIDATION_FAILED });
    }
    if (value === "") {
      throw new ValidationError({ message: `'${name}' must not be empty.`, code: ErrorCode.VALIDATION_FAILED });
    }
    return value;
  }
}
