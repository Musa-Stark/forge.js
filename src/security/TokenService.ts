import { createHash, randomBytes, randomInt, timingSafeEqual, createHmac } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { BadRequestError, ErrorCode, UnauthorizedError } from "../errors/index.js";
import type { Duration } from "../config/Duration.js";

export type TokenType = "access" | "refresh";

export interface MfaChallengeClaims {
  typ: "mfa";
  sub: string;
}

export interface OAuthStateClaims {
  typ: "oauth_state";
  /** Provider name the flow was started for. */
  prv: string;
  /** Random `state` sent to the provider. */
  st: string;
  /** PKCE code verifier. */
  cv?: string;
  /** Safe front-end path to return to after sign-in. */
  rt?: string;
}

export interface AccessClaims {
  sub: string;
  typ: "access";
}

export interface RefreshClaims {
  sub: string;
  typ: "refresh";
  /** Unique id of this refresh token (its database record). */
  jti: string;
  /** Id shared by every token descended from one login. */
  fam: string;
}

const ALGORITHM = "HS256" as const;
const ISSUER = "forge";

const ERROR_CODES: Record<TokenType, { missing: string; invalid: string; expired: string }> = {
  access: {
    missing: ErrorCode.ACCESS_TOKEN_MISSING,
    invalid: ErrorCode.ACCESS_TOKEN_INVALID,
    expired: ErrorCode.ACCESS_TOKEN_EXPIRED,
  },
  refresh: {
    missing: ErrorCode.REFRESH_TOKEN_MISSING,
    invalid: ErrorCode.REFRESH_TOKEN_INVALID,
    expired: ErrorCode.REFRESH_TOKEN_EXPIRED,
  },
};

/**
 * Signs and verifies JWTs.
 *
 * Hardening over 1.x: the algorithm is pinned (no `alg` confusion), tokens
 * carry a `typ` claim so a long-lived refresh token can never be used as an
 * access token, and issuer is checked.
 */
export class TokenService {
  constructor(private readonly secret: string | undefined) {}

  signAccess(userId: string, expiresIn: Duration): string {
    return this.sign({ sub: userId, typ: "access" } satisfies AccessClaims, expiresIn);
  }

  signRefresh(claims: Omit<RefreshClaims, "typ">, expiresIn: Duration): string {
    return this.sign({ ...claims, typ: "refresh" } satisfies RefreshClaims, expiresIn);
  }

  verifyAccess(token: string | undefined): AccessClaims {
    return this.verify<AccessClaims>(token, "access");
  }

  verifyRefresh(token: string | undefined): RefreshClaims {
    const claims = this.verify<RefreshClaims>(token, "refresh");
    if (typeof claims.jti !== "string" || typeof claims.fam !== "string") {
      throw new UnauthorizedError({ message: "The refresh token is invalid.", code: ErrorCode.REFRESH_TOKEN_INVALID });
    }
    return claims;
  }

  /** Proof that the password (or magic link) step succeeded and a second factor is now needed. Not a session. */
  signMfaChallenge(userId: string, expiresIn: Duration): string {
    return this.sign({ sub: userId, typ: "mfa" } satisfies MfaChallengeClaims, expiresIn);
  }

  verifyMfaChallenge(token: string | undefined): MfaChallengeClaims {
    const invalid = () =>
      new UnauthorizedError({ message: "The second-factor step has expired. Please sign in again.", code: ErrorCode.MFA_CHALLENGE_INVALID });
    if (!token || typeof token !== "string") throw invalid();
    try {
      const payload = jwt.verify(token, this.requireSecret(), { algorithms: [ALGORITHM], issuer: ISSUER }) as Partial<MfaChallengeClaims>;
      if (payload.typ !== "mfa" || typeof payload.sub !== "string") throw invalid();
      return payload as MfaChallengeClaims;
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw invalid();
    }
  }

  /** Short-lived, signed envelope for the OAuth `state`, PKCE verifier and return path (kept in a cookie). */
  signOAuthState(claims: Omit<OAuthStateClaims, "typ">, expiresIn: Duration): string {
    return this.sign({ ...claims, typ: "oauth_state" } satisfies OAuthStateClaims, expiresIn);
  }

  verifyOAuthState(token: string | undefined): OAuthStateClaims {
    const invalid = () =>
      new BadRequestError({
        message: "The sign-in session is missing or has expired. Please start again.",
        code: ErrorCode.OAUTH_STATE_INVALID,
      });
    if (!token) throw invalid();
    try {
      const payload = jwt.verify(token, this.requireSecret(), { algorithms: [ALGORITHM], issuer: ISSUER }) as Partial<OAuthStateClaims>;
      if (payload.typ !== "oauth_state" || typeof payload.prv !== "string" || typeof payload.st !== "string") throw invalid();
      return payload as OAuthStateClaims;
    } catch (error) {
      if (error instanceof BadRequestError) throw error;
      throw invalid();
    }
  }

  private sign(payload: object, expiresIn: Duration): string {
    return jwt.sign(payload, this.requireSecret(), {
      algorithm: ALGORITHM,
      issuer: ISSUER,
      expiresIn: Math.max(1, expiresIn.toSeconds()),
    });
  }

  private verify<T extends JwtPayload>(token: string | undefined, type: TokenType): T {
    const codes = ERROR_CODES[type];
    if (!token || typeof token !== "string") {
      throw new UnauthorizedError({
        message: type === "access" ? "Authentication is required." : "No refresh token was provided.",
        code: codes.missing,
      });
    }

    try {
      const payload = jwt.verify(token, this.requireSecret(), { algorithms: [ALGORITHM], issuer: ISSUER }) as T;
      if (payload.typ !== type || typeof payload.sub !== "string") {
        throw new UnauthorizedError({ message: "The token is invalid.", code: codes.invalid });
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      const name = (error as { name?: string }).name;
      throw new UnauthorizedError({
        message: name === "TokenExpiredError" ? "The token has expired." : "The token is invalid.",
        code: name === "TokenExpiredError" ? codes.expired : codes.invalid,
        cause: error,
      });
    }
  }

  private requireSecret(): string {
    if (!this.secret) throw new Error("jwtSecret is not configured");
    return this.secret;
  }
}

/** Hashing and comparison helpers for high-entropy secrets (refresh tokens, reset tokens). */
export const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

export const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/** Generates a URL-safe random token. */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");

/** Generates a numeric code using a cryptographically secure RNG. */
export const randomNumericCode = (digits = 6): string =>
  randomInt(0, 10 ** digits).toString().padStart(digits, "0");

/** Keyed hash for short one-time codes so a database leak does not expose live codes. */
export const hmacCode = (code: string, key: string): string =>
  createHmac("sha256", key).update(code).digest("hex");
