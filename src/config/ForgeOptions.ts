import type { CorsOptions } from "cors";
import type { Store } from "express-rate-limit";
import type { UnifiedField } from "../fields/unified.types.js";
import type { Collection } from "../types/Collection.js";
import type { AuthMode } from "../types/Route.js";
import type { CommonEmailPlaceholders } from "../types/email/static-config.type.js";
import type { OAuthProfile } from "../oauth/OAuthProvider.js";
import type { OAuthProviderEntry } from "../oauth/OAuthProviderFactory.js";
import type { DurationType } from "./Duration.js";

export type { AuthMode } from "../types/Route.js";
/** @deprecated Use {@link AuthMode}. */
export type authMode = AuthMode;

/** Names of the auth fields in request bodies and in the user schema. */
export interface AuthFieldNames {
  email: string;
  password: string;
  otp: string;
  purpose: string;
}

export interface OtpOptions {
  /** How long a one-time code stays valid. @default "5m" */
  expiresIn?: DurationType;
  /** Wrong guesses allowed per code. @default 5 */
  maxAttempts?: number;
  /** Minimum delay between two e-mails for the same request. @default "60s" */
  resendCooldown?: DurationType;
  /** How many times a code may be re-sent. @default 5 */
  maxResends?: number;
  /** After a password-reset code is verified, how long the user has to set the new password. @default "10m" */
  verifiedWindow?: DurationType;
}

export interface CookieOptions {
  /** @default "none" in production (cross-site SPAs), "lax" otherwise */
  sameSite?: "lax" | "strict" | "none";
  /** @default true in production */
  secure?: boolean;
  /** Cookie `Domain` attribute. Host-only cookies (unset) are the safest default. */
  domain?: string;
  /** @default "/" */
  path?: string;
}

/**
 * How an OAuth sign-in is matched to an existing local account that has the same e-mail.
 * - `"auto"` (default): link only when every local account's e-mail was verified at sign-up (`signupMode: "otp"`).
 * - `"always"`: link whenever the *provider* says the e-mail is verified. Only safe if you trust your own sign-up.
 * - `"never"`: never link; the user must sign in the old way.
 */
export type AccountLinking = "auto" | "always" | "never";

export interface OAuthOptions {
  /** Enabled providers: `{ provider: "google" | "github", clientId, clientSecret }` or your own `OAuthProvider` instance. */
  providers: OAuthProviderEntry[];
  /**
   * Where to send the browser after a successful sign-in (must be on one of your `frontendURL(s)`).
   * Omit it to get the session as JSON instead (handy for mobile apps and tests).
   */
  successRedirect?: string;
  /** Where to send the browser when sign-in fails; `?error=<CODE>` is appended. Same origin rule. */
  failureRedirect?: string;
  accountLinking?: AccountLinking;
  /** How long the user has to finish the provider's consent screen. @default "10m" */
  stateAge?: DurationType;
  /**
   * Extra fields for a brand-new user, e.g. when your schema requires more than `name` and `email`.
   * The e-mail and a random unusable password are always set by Forge.
   */
  userFromProfile?: (profile: OAuthProfile) => Record<string, unknown>;
}

export interface MagicLinkOptions {
  /**
   * The front-end page that receives the link (`<url>?token=...`). It must read the token and `POST` it to
   * `/auth/magic-link/verify`: opening the link must not sign anyone in by itself, because mail scanners
   * "click" links to check them. Must be on one of your `frontendURL(s)`.
   */
  url: string;
  /** How long a link stays valid. @default "15m" */
  expiresIn?: DurationType;
  /** Minimum time between two links for the same address. @default "60s" */
  resendCooldown?: DurationType;
  /** Create an account for an unknown e-mail on first use. @default true */
  allowSignup?: boolean;
  /**
   * Require the link to be opened in the browser that asked for it. Stops an attacker from mailing
   * *their own* link to a victim to sign them into the attacker's account. Turn off for mobile apps or
   * if users often switch devices. @default true
   */
  sameDevice?: boolean;
  /** Same meaning as `oauth.accountLinking`: may a verified e-mail sign in to an existing local account? @default "auto" */
  accountLinking?: AccountLinking;
}

export interface MfaOptions {
  /** Shown in the authenticator app next to the account name (usually your product name). */
  issuer: string;
  /** How long the user has to enter their code after the first step. @default "5m" */
  challengeAge?: DurationType;
  /** Wrong codes allowed before the account's second factor is locked. @default 5 */
  maxAttempts?: number;
  /** How long a lock lasts. @default "5m" */
  lockoutDuration?: DurationType;
  /** Recovery codes generated on activation. @default 10 */
  recoveryCodes?: number;
  /** Clock drift accepted, in 30-second steps either side. @default 1 */
  window?: number;
}

export interface AuthConfig {
  mode: "builtin" | "manual";
  returnAccessToken?: boolean;
  returnRefreshToken?: boolean;
  rotateRefreshToken?: boolean;
  refreshTokenRotationInterval?: DurationType;
  /**
   * A refresh token that was rotated away may be presented again within this
   * window (two browser tabs refreshing at once) without revoking the session.
   * @default "10s"
   */
  refreshReuseGracePeriod?: DurationType;
  verifyAccessUser?: boolean;
  fieldsObj?: Partial<AuthFieldNames>;
  mongooseConfig?: {
    model: string;
    schema: Record<string, UnifiedField>;
  };
  accessTokenName?: string;
  refreshTokenName?: string;
  accessTokenAge?: DurationType;
  refreshTokenAge?: DurationType;
  signupMode?: AuthMode;
  loginMode?: AuthMode;
  otp?: OtpOptions;
  cookie?: CookieOptions;
  /** "Sign in with Google / GitHub / ...". */
  oauth?: OAuthOptions;
  /** Passwordless sign-in by e-mailed link. */
  magicLink?: MagicLinkOptions;
  /** Authenticator-app (TOTP) two-factor authentication with recovery codes. */
  mfa?: MfaOptions;
}

export interface AdminConfig {
  mode: "builtin" | "manual";
}

export interface AccountConfig {
  mode: "builtin" | "manual";
}

export type CorsConfig = CorsOptions;

export interface BuiltInConfig {
  auth: AuthConfig;
  admin: AdminConfig;
  account: AccountConfig;
  email?: CommonEmailPlaceholders;
}

/** Everything you can pass to `new Forge({...})`. */
export interface ForgeOptions {
  builtinConfig?: Partial<BuiltInConfig>;
  collections?: Collection[];

  // Server
  port?: number;
  apiVersion?: number;
  ENV?: "development" | "production" | "test" | (string & {});
  backendURL?: string;
  frontendURL?: string;
  frontendURLs?: string[];
  corsConfig?: CorsConfig;
  /** Value for Express `trust proxy`. Set it when running behind a load balancer. */
  trustProxy?: boolean | number | string;
  /** Print the start-up banner and request logs. @default true (false when ENV is "test") */
  logRequests?: boolean;
  /** Include `hint`/`details` in error responses. @default true outside production */
  exposeErrorDetails?: boolean;
  /** Largest accepted JSON / form body (anything `bytes` understands). @default "100kb" */
  bodyLimit?: string;

  // Database
  isOffline?: boolean;
  mongoDBURI?: string;
  databaseName?: string;

  // Security
  jwtSecret?: string;
  masterKey?: string;
  /** @deprecated 1.x name. In production it is used as `builtinConfig.auth.cookie.domain` when that is not set. */
  domain?: string;
  /** Roles that count as administrators. @default ["admin"] */
  adminRoles?: string[];
  /** Fields only administrators may write (they are stripped from other users' payloads). @default ["role"] */
  protectedFields?: string[];

  // Rate limiting
  rateLimitDuration?: DurationType;
  maxReqLimit?: number;
  rateLimitMsg?: string;
  /** Stricter limit for sign-up / login / OTP / password-reset endpoints (per IP). @default 20 */
  authMaxReqLimit?: number;
  /** Share rate-limit counters between instances (e.g. a Redis store). */
  rateLimitStore?: Store;

  // E-mail
  systemEmailSender?: string;
  resendAPIKey?: string;

  // Uploads
  cloudinaryAPIKey?: string;
  cloudinaryAPISecret?: string;
  cloudinaryCloudName?: string;
  cloudinaryFolderName?: string;
  /** Maximum size of one uploaded file, in bytes. @default 5 MiB */
  uploadMaxFileSize?: number;
  /** Maximum files per request. @default 10 */
  uploadMaxFiles?: number;

  // Pagination
  /** `readAll` page size when `?limit` is omitted. @default 50 */
  defaultPageSize?: number;
  /** Largest `?limit` accepted by `readAll`. @default 100 */
  maxPageSize?: number;
}
