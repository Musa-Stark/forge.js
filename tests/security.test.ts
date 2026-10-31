import jwt from "jsonwebtoken";
import sodium from "libsodium-wrappers-sumo";
import { describe, expect, it } from "vitest";
import { Duration } from "../src/config/Duration.js";
import { ConfigurationError, ErrorCode, InternalError, UnauthorizedError } from "../src/errors/index.js";
import { CryptoVault, generateJWTSecret, generateMasterKey, isSealedValue } from "../src/security/CryptoVault.js";
import { PasswordHasher } from "../src/security/PasswordHasher.js";
import { hmacCode, randomNumericCode, randomToken, safeEqual, sha256, TokenService } from "../src/security/TokenService.js";

describe("PasswordHasher", () => {
  const hasher = new PasswordHasher();

  it("produces self-describing Argon2id hashes with a unique salt", async () => {
    const [a, b] = await Promise.all([hasher.hash("correct horse"), hasher.hash("correct horse")]);
    expect(a).toMatch(/^\$argon2id\$/);
    expect(a).not.toBe(b);
  });

  it("verifies right and wrong passwords", async () => {
    const hash = await hasher.hash("correct horse");
    expect(await hasher.verify("correct horse", hash)).toBe(true);
    expect(await hasher.verify("Correct horse", hash)).toBe(false);
    expect(await hasher.verify("", hash)).toBe(false);
  });

  it("never throws on garbage input", async () => {
    expect(await hasher.verify("x", "not-a-hash")).toBe(false);
    expect(await hasher.verify("x", undefined)).toBe(false);
    expect(await hasher.verify("x", null)).toBe(false);
    expect(await hasher.verify("x", "a:")).toBe(false);
  });

  it("refuses to hash an empty password", async () => {
    await expect(hasher.hash("")).rejects.toBeInstanceOf(InternalError);
  });

  it("still accepts hashes written by Forge 1.x (salt:hash) and asks for a rehash", async () => {
    await sodium.ready;
    const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
    const raw = sodium.crypto_pwhash(32, "old-password", salt, sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE, sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE, sodium.crypto_pwhash_ALG_DEFAULT);
    const legacy = `${sodium.to_base64(salt)}:${sodium.to_base64(raw)}`;

    expect(await hasher.verify("old-password", legacy)).toBe(true);
    expect(await hasher.verify("wrong", legacy)).toBe(false);
    expect(await hasher.needsRehash(legacy)).toBe(true);
    expect(await hasher.needsRehash(await hasher.hash("fresh"))).toBe(false);
  });

  it("can burn comparable time for unknown accounts", async () => {
    await expect(hasher.verifyAgainstDummy("anything")).resolves.toBeUndefined();
  });
});

describe("CryptoVault", () => {
  it("round-trips a value through seal/unseal", async () => {
    const vault = new CryptoVault(await generateMasterKey());
    const sealed = await vault.seal("my secret ✓ unicode");
    expect(isSealedValue(sealed)).toBe(true);
    expect(JSON.stringify(sealed)).not.toContain("my secret");
    expect(await vault.unseal(sealed)).toBe("my secret ✓ unicode");
  });

  it("uses a fresh key pair and nonce for each value", async () => {
    const vault = new CryptoVault(await generateMasterKey());
    const [a, b] = [await vault.seal("same"), await vault.seal("same")];
    expect(a.str).not.toBe(b.str);
    expect(a.publicKey).not.toBe(b.publicKey);
    expect(a.nonce).not.toBe(b.nonce);
  });

  it("cannot be opened with a different master key", async () => {
    const sealed = await new CryptoVault(await generateMasterKey()).seal("secret");
    await expect(new CryptoVault(await generateMasterKey()).unseal(sealed)).rejects.toMatchObject({ code: ErrorCode.DECRYPTION_FAILED });
  });

  it("detects tampering", async () => {
    const vault = new CryptoVault(await generateMasterKey());
    const sealed = await vault.seal("secret");
    const tampered = { ...sealed, str: sealed.str.slice(0, -4) + "AAAA" };
    await expect(vault.unseal(tampered)).rejects.toMatchObject({ code: ErrorCode.DECRYPTION_FAILED });
  });

  it("rejects malformed stored values and empty input", async () => {
    const vault = new CryptoVault(await generateMasterKey());
    await expect(vault.unseal({ str: "", nonce: "", publicKey: "", securedPrivateKey: "" })).rejects.toMatchObject({ code: ErrorCode.DECRYPTION_FAILED });
    await expect(vault.seal("")).rejects.toMatchObject({ code: ErrorCode.ENCRYPTION_FAILED });
    expect(isSealedValue(null)).toBe(false);
    expect(isSealedValue({ str: "x" })).toBe(false);
  });

  it("explains how to fix a missing master key", async () => {
    const vault = new CryptoVault(undefined);
    expect(vault.isConfigured).toBe(false);
    await expect(vault.seal("x")).rejects.toBeInstanceOf(ConfigurationError);
  });

  it("generates well-formed secrets", async () => {
    const key = await generateMasterKey();
    expect(Buffer.from(key, "base64")).toHaveLength(32);
    expect(Buffer.from(await generateJWTSecret(), "base64")).toHaveLength(64);
  });
});

describe("TokenService", () => {
  const secret = "s".repeat(40);
  const tokens = new TokenService(secret);
  const age = Duration.parse("10m");

  it("signs and verifies access tokens", () => {
    const claims = tokens.verifyAccess(tokens.signAccess("user1", age));
    expect(claims).toMatchObject({ sub: "user1", typ: "access" });
  });

  it("signs and verifies refresh tokens with jti and family", () => {
    const claims = tokens.verifyRefresh(tokens.signRefresh({ sub: "u", jti: "j", fam: "f" }, age));
    expect(claims).toMatchObject({ sub: "u", jti: "j", fam: "f", typ: "refresh" });
  });

  it("does not accept a refresh token as an access token (1.x did)", () => {
    const refresh = tokens.signRefresh({ sub: "u", jti: "j", fam: "f" }, Duration.parse("30d"));
    expect(() => tokens.verifyAccess(refresh)).toThrow(UnauthorizedError);
  });

  it("does not accept an access token as a refresh token", () => {
    expect(() => tokens.verifyRefresh(tokens.signAccess("u", age))).toThrow(UnauthorizedError);
  });

  it("rejects unsigned 'alg: none' tokens", () => {
    const forged = jwt.sign({ sub: "admin", typ: "access" }, "", { algorithm: "none" as never });
    expect(() => tokens.verifyAccess(forged)).toThrow(UnauthorizedError);
  });

  it("rejects tokens signed with another secret or algorithm", () => {
    const other = jwt.sign({ sub: "u", typ: "access" }, "x".repeat(40), { issuer: "forge" });
    expect(() => tokens.verifyAccess(other)).toThrow(UnauthorizedError);
    const hs512 = jwt.sign({ sub: "u", typ: "access" }, secret, { algorithm: "HS512", issuer: "forge" });
    expect(() => tokens.verifyAccess(hs512)).toThrow(UnauthorizedError);
  });

  it("rejects tokens from another issuer", () => {
    const foreign = jwt.sign({ sub: "u", typ: "access" }, secret, { issuer: "someone-else" });
    expect(() => tokens.verifyAccess(foreign)).toThrow(UnauthorizedError);
  });

  it("distinguishes expired from invalid tokens", () => {
    const expired = jwt.sign({ sub: "u", typ: "access" }, secret, { issuer: "forge", expiresIn: -10 });
    expect(() => tokens.verifyAccess(expired)).toThrowError(expect.objectContaining({ code: ErrorCode.ACCESS_TOKEN_EXPIRED }));
    expect(() => tokens.verifyAccess("garbage")).toThrowError(expect.objectContaining({ code: ErrorCode.ACCESS_TOKEN_INVALID }));
    expect(() => tokens.verifyRefresh("garbage")).toThrowError(expect.objectContaining({ code: ErrorCode.REFRESH_TOKEN_INVALID }));
  });

  it("reports missing tokens with their own codes", () => {
    expect(() => tokens.verifyAccess(undefined)).toThrowError(expect.objectContaining({ code: ErrorCode.ACCESS_TOKEN_MISSING }));
    expect(() => tokens.verifyRefresh("")).toThrowError(expect.objectContaining({ code: ErrorCode.REFRESH_TOKEN_MISSING }));
  });

  it("rejects refresh tokens that lack jti/fam", () => {
    const partial = jwt.sign({ sub: "u", typ: "refresh" }, secret, { issuer: "forge" });
    expect(() => tokens.verifyRefresh(partial)).toThrow(UnauthorizedError);
  });
});

describe("token helpers", () => {
  it("sha256 and safeEqual", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("randomToken is URL-safe and unique", () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(a);
  });

  it("randomNumericCode keeps leading zeros and the right length", () => {
    for (let i = 0; i < 200; i++) expect(randomNumericCode(6)).toMatch(/^\d{6}$/);
    expect(randomNumericCode(3)).toHaveLength(3);
  });

  it("hmacCode depends on both code and key", () => {
    expect(hmacCode("123456", "k")).toBe(hmacCode("123456", "k"));
    expect(hmacCode("123456", "k")).not.toBe(hmacCode("123456", "k2"));
    expect(hmacCode("123456", "k")).not.toBe(hmacCode("123457", "k"));
  });
});
