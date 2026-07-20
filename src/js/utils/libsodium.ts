import sodium from "libsodium-wrappers-sumo";
import AppError from "./AppError.js";
import getErrorDetail from "./getErrorDetail.js";
import type { Route } from "../types/Collection.js";

interface SealResult {
  str: string;
  nonce: string;
  publicKey: string;
  securedPrivateKey: string;
}

// Hash password
export const hash = async (str: string, route: Route): Promise<string> => {
  if (!str) {
    throw new AppError({
      message: "string is required to hash",
      statusCode: 404,
      code: "LIBSODIUM_HASH_ERROR",
      hint: "This issue requires a fix from the framework developer.",
      details: getErrorDetail(route),
    });
  }

  await sodium.ready;

  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);

  const hashStr = sodium.crypto_pwhash(
    32,
    str,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT,
  );

  return `${sodium.to_base64(salt)}:${sodium.to_base64(hashStr)}`;
};

// Verify password
export const verifyHash = async (
  password: string,
  storedHash: string,
  route: Route,
): Promise<boolean> => {
  if (!password) {
    throw new AppError({
      message: "string is required to verify",
      statusCode: 404,
      code: "LIBSODIUM_HASH_ERROR",
      hint: "This issue requires a fix from the framework developer.",
      details: getErrorDetail(route),
    });
  }

  if (!storedHash) {
    throw new AppError({
      message: "storedHash is required to verify",
      statusCode: 404,
      code: "LIBSODIUM_HASH_ERROR",
      hint: "This issue requires a fix from the framework developer.",
      details: getErrorDetail(route),
    });
  }

  await sodium.ready;

  const [saltB64, hashB64] = storedHash.split(":");

  if (!saltB64 || !hashB64) {
    throw new AppError({
      message: "Invalid stored has format",
      statusCode: 404,
      code: "LIBSODIUM_HASH_ERROR",
      hint: "This issue requires a fix from the framework developer.",
      details: getErrorDetail(route),
    });
  }

  const salt = sodium.from_base64(saltB64);
  const originalHash = sodium.from_base64(hashB64);

  const testHash = sodium.crypto_pwhash(
    32,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT,
  );

  return sodium.memcmp(originalHash, testHash);
};

// Generate master key
export const generateMasterKey = async (): Promise<string> => {
  await sodium.ready;

  const key = sodium.crypto_secretbox_keygen();

  const base64Key = sodium.to_base64(key, sodium.base64_variants.ORIGINAL);

  console.log(base64Key);
  return base64Key;
};

// Generate JWT secret
export const generateJWTSecret = async (): Promise<string> => {
  await sodium.ready;

  const secret = sodium.randombytes_buf(64);

  const base64Secret = sodium.to_base64(
    secret,
    sodium.base64_variants.ORIGINAL,
  );

  console.log(base64Secret);
  return base64Secret;
};

// Seal
export const seal = async (
  input: string,
  masterKey: string,
  route: Route,
): Promise<SealResult> => {
  try {
    if (!input) {
      throw new AppError({
        message: "string is required to encrypt",
        statusCode: 404,
        code: "LIBSODIUM_HASH_ERROR",
        hint: "Provide a string to encrypt it.",
        details: getErrorDetail(route),
      });
    }

    if (!masterKey) {
      throw new AppError({
        message: "Master key is required for encryption",
        statusCode: 404,
        code: "LIBSODIUM_HASH_ERROR",
        hint: "Provide masterkey in StarkForge({}) - initializing class",
        details: getErrorDetail(route),
      });
    }

    await sodium.ready;

    const keyPair = sodium.crypto_box_keypair();
    const strBytes = sodium.from_string(input);

    const encrypted = sodium.crypto_box_seal(strBytes, keyPair.publicKey);

    const masterKeyBytes = sodium.from_base64(
      masterKey,
      sodium.base64_variants.ORIGINAL,
    );

    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

    const encryptedPrivateKey = sodium.crypto_secretbox_easy(
      keyPair.privateKey,
      nonce,
      masterKeyBytes,
    );

    return {
      str: sodium.to_base64(encrypted),
      nonce: sodium.to_base64(nonce),
      publicKey: sodium.to_base64(keyPair.publicKey),
      securedPrivateKey: sodium.to_base64(encryptedPrivateKey),
    };
  } catch (error: unknown) {
    if (error instanceof AppError) throw error;

    console.error(error);

    throw new AppError({
      message: "Error while encrypting",
      statusCode: 404,
      code: "LIBSODIUM_HASH_ERROR",
      hint: "This issue requires a fix from the framework developer.",
      details: getErrorDetail(route),
    });
  }
};

// Unseal
export const unSeal = async (
  str: string,
  nonce: string,
  publicKey: string,
  securedPrivateKey: string,
  masterKey: string,
  route: Route,
): Promise<string> => {
  try {
    if (!str) {
      throw new AppError({
        message: "Encrypted string is required for decryption",
        statusCode: 400,
        code: "LIBSODIUM_DECRYPT_ERROR",
        hint: "Provide the encrypted string returned by seal().",
        details: getErrorDetail(route),
      });
    }

    if (!nonce) {
      throw new AppError({
        message: "Nonce is required for decryption",
        statusCode: 400,
        code: "LIBSODIUM_DECRYPT_ERROR",
        hint: "Provide the nonce returned by seal().",
        details: getErrorDetail(route),
      });
    }

    if (!publicKey) {
      throw new AppError({
        message: "Public key is required for decryption",
        statusCode: 400,
        code: "LIBSODIUM_DECRYPT_ERROR",
        hint: "Provide the public key returned by seal().",
        details: getErrorDetail(route),
      });
    }

    if (!securedPrivateKey) {
      throw new AppError({
        message: "Secured private key is required for decryption",
        statusCode: 400,
        code: "LIBSODIUM_DECRYPT_ERROR",
        hint: "Provide the secured private key returned by seal().",
        details: getErrorDetail(route),
      });
    }

    if (!masterKey) {
      throw new AppError({
        message: "Master key is required for decryption",
        statusCode: 400,
        code: "LIBSODIUM_DECRYPT_ERROR",
        hint: "Provide the master key used during encryption.",
        details: getErrorDetail(route),
      });
    }

    await sodium.ready;

    const masterKeyBytes = sodium.from_base64(
      masterKey,
      sodium.base64_variants.ORIGINAL,
    );

    const nonceBytes = sodium.from_base64(nonce);
    const securedPrivateKeyBytes = sodium.from_base64(securedPrivateKey);
    const publicKeyBytes = sodium.from_base64(publicKey);
    const encryptedBytes = sodium.from_base64(str);

    const privateKey = sodium.crypto_secretbox_open_easy(
      securedPrivateKeyBytes,
      nonceBytes,
      masterKeyBytes,
    );

    const decrypted = sodium.crypto_box_seal_open(
      encryptedBytes,
      publicKeyBytes,
      privateKey,
    );

    return sodium.to_string(decrypted);
  } catch (error: unknown) {
    if (error instanceof AppError) throw error;

    console.error(error);

    throw new AppError({
      message: "Error while decrypting",
      statusCode: 500,
      code: "LIBSODIUM_DECRYPT_ERROR",
      hint: "This issue requires a fix from the framework developer.",
      details: getErrorDetail(route),
    });
  }
};
