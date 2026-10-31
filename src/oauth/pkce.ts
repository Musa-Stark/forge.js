import { createHash, randomBytes } from "node:crypto";

/** RFC 7636 helpers (Proof Key for Code Exchange, method S256). */
export const pkce = {
  /** 43-character URL-safe random verifier (256 bits of entropy). */
  generateVerifier: (): string => randomBytes(32).toString("base64url"),

  /** `BASE64URL(SHA256(verifier))` */
  challengeFor: (verifier: string): string => createHash("sha256").update(verifier).digest("base64url"),
};
