import { ConfigurationError, ErrorCode, InternalError } from "../errors/index.js";
import { getSodium } from "./Sodium.js";

/** The value stored in the database for an encrypted field. */
export interface SealedValue {
  str: string;
  nonce: string;
  publicKey: string;
  securedPrivateKey: string;
}

export const isSealedValue = (value: unknown): value is SealedValue => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return ["str", "nonce", "publicKey", "securedPrivateKey"].every((k) => typeof v[k] === "string" && v[k] !== "");
};

/**
 * Field-level encryption.
 *
 * Every value gets its own key pair. The value is sealed with the public key,
 * and the private key is itself encrypted with the master key, so a database
 * leak alone reveals nothing. The stored format is identical to Forge 1.x.
 */
export class CryptoVault {
  constructor(private readonly masterKey: string | undefined) {}

  get isConfigured(): boolean {
    return Boolean(this.masterKey);
  }

  async seal(plain: string): Promise<SealedValue> {
    const sodium = await getSodium();
    const key = this.requireKey(sodium);
    if (typeof plain !== "string" || plain === "") {
      throw new InternalError({ message: "A non-empty string is required to encrypt.", code: ErrorCode.ENCRYPTION_FAILED });
    }

    try {
      const keyPair = sodium.crypto_box_keypair();
      const encrypted = sodium.crypto_box_seal(sodium.from_string(plain), keyPair.publicKey);
      const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
      const securedPrivateKey = sodium.crypto_secretbox_easy(keyPair.privateKey, nonce, key);

      return {
        str: sodium.to_base64(encrypted),
        nonce: sodium.to_base64(nonce),
        publicKey: sodium.to_base64(keyPair.publicKey),
        securedPrivateKey: sodium.to_base64(securedPrivateKey),
      };
    } catch (cause) {
      throw new InternalError({ message: "Encryption failed.", code: ErrorCode.ENCRYPTION_FAILED, cause });
    }
  }

  async unseal(sealed: SealedValue): Promise<string> {
    const sodium = await getSodium();
    const key = this.requireKey(sodium);
    if (!isSealedValue(sealed)) {
      throw new InternalError({ message: "The stored encrypted value is malformed.", code: ErrorCode.DECRYPTION_FAILED });
    }

    try {
      const privateKey = sodium.crypto_secretbox_open_easy(
        sodium.from_base64(sealed.securedPrivateKey),
        sodium.from_base64(sealed.nonce),
        key,
      );
      const plain = sodium.crypto_box_seal_open(
        sodium.from_base64(sealed.str),
        sodium.from_base64(sealed.publicKey),
        privateKey,
      );
      return sodium.to_string(plain);
    } catch (cause) {
      throw new InternalError({
        message: "Decryption failed. The master key may have changed.",
        code: ErrorCode.DECRYPTION_FAILED,
        cause,
      });
    }
  }

  private requireKey(sodium: Awaited<ReturnType<typeof getSodium>>): Uint8Array {
    if (!this.masterKey) {
      throw new ConfigurationError({
        message: "A master key is required for field encryption.",
        hint: "Run generateMasterKey() once, store the result in an environment variable and pass it as 'masterKey'.",
      });
    }
    return sodium.from_base64(this.masterKey, sodium.base64_variants.ORIGINAL);
  }
}

/** Generates a base64 master key for {@link CryptoVault}. Keep it secret and never rotate it casually. */
export const generateMasterKey = async (): Promise<string> => {
  const sodium = await getSodium();
  return sodium.to_base64(sodium.crypto_secretbox_keygen(), sodium.base64_variants.ORIGINAL);
};

/** Generates a 64-byte random secret for signing JWTs. */
export const generateJWTSecret = async (): Promise<string> => {
  const sodium = await getSodium();
  return sodium.to_base64(sodium.randombytes_buf(64), sodium.base64_variants.ORIGINAL);
};
