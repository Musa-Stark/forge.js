import { InternalError } from "../errors/index.js";
import { getSodium } from "./Sodium.js";

/**
 * Argon2id password hashing.
 *
 * New hashes use libsodium's self-describing string format (`$argon2id$...`),
 * which embeds salt and parameters and is verified in constant time. Hashes
 * written by Forge 1.x (`salt:hash`, both base64) are still accepted, and
 * {@link needsRehash} tells the caller when to upgrade them after a login.
 */
export class PasswordHasher {
  private dummyHash: Promise<string> | undefined;

  async hash(password: string): Promise<string> {
    if (typeof password !== "string" || password.length === 0) {
      throw new InternalError({ message: "Cannot hash an empty password." });
    }
    const sodium = await getSodium();
    return sodium.crypto_pwhash_str(
      password,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    );
  }

  async verify(password: string, stored: string | undefined | null): Promise<boolean> {
    if (typeof password !== "string" || !password || typeof stored !== "string" || !stored) return false;

    const sodium = await getSodium();
    try {
      if (stored.startsWith("$argon2")) {
        return sodium.crypto_pwhash_str_verify(stored, password);
      }
      return this.verifyLegacy(sodium, password, stored);
    } catch {
      return false;
    }
  }

  /** True when the stored hash uses the 1.x format or weaker parameters. */
  async needsRehash(stored: string): Promise<boolean> {
    if (!stored.startsWith("$argon2")) return true;
    const sodium = await getSodium();
    try {
      return sodium.crypto_pwhash_str_needs_rehash(
        stored,
        sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
        sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      );
    } catch {
      return true;
    }
  }

  /**
   * Burns the same CPU time as a real verification. Call it when the account
   * does not exist so response time does not reveal which e-mails are registered.
   */
  async verifyAgainstDummy(password: string): Promise<void> {
    this.dummyHash ??= this.hash("forge-timing-equaliser");
    await this.verify(password, await this.dummyHash);
  }

  private verifyLegacy(sodium: Awaited<ReturnType<typeof getSodium>>, password: string, stored: string): boolean {
    const [saltB64, hashB64] = stored.split(":");
    if (!saltB64 || !hashB64) return false;

    const salt = sodium.from_base64(saltB64);
    const expected = sodium.from_base64(hashB64);
    const actual = sodium.crypto_pwhash(
      32,
      password,
      salt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_DEFAULT,
    );
    return expected.length === actual.length && sodium.memcmp(expected, actual);
  }
}
