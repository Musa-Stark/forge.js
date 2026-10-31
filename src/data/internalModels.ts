import mongoose from "mongoose";
import type { ModelDefinition } from "./Repository.js";

export const REFRESH_TOKEN_MODEL = "ForgeRefreshToken";
export const OTP_REQUEST_MODEL = "ForgeOtpRequest";
export const OAUTH_IDENTITY_MODEL = "ForgeOAuthIdentity";
export const MAGIC_LINK_MODEL = "ForgeMagicLink";
export const MFA_FACTOR_MODEL = "ForgeMfaFactor";

/** Server-side record of every refresh token (stored hashed, never in plain text). */
export const refreshTokenModel = (userModel: string): ModelDefinition => ({
  name: REFRESH_TOKEN_MODEL,
  schema: {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: userModel, required: true, index: true },
    tokenHash: { type: String, required: true, select: false },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, default: Date.now },
    rotatedAt: { type: Date },
    revokedAt: { type: Date },
    userAgent: { type: String, maxlength: 512 },
    ip: { type: String, maxlength: 64 },
  },
  indexes: [{ fields: { expiresAt: 1 }, expireAfterSeconds: 0 }],
});

/** One pending one-time-code flow (signup, login, password reset). */
export const otpRequestModel = (): ModelDefinition => ({
  name: OTP_REQUEST_MODEL,
  schema: {
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: { type: String, required: true },
    codeHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    resends: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
    /** Data to apply once the code is verified (e.g. the sign-up payload with a hashed password). */
    payload: { type: Object as never, default: undefined } as never,
    verifiedAt: { type: Date },
    resetTokenHash: { type: String, select: false },
    resetExpiresAt: { type: Date },
  },
  indexes: [
    { fields: { email: 1, purpose: 1 }, unique: true },
    { fields: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
});

/** Links a local user to an account at an external provider ("this Google account is Ada"). One user can have several. */
export const oauthIdentityModel = (userModel: string): ModelDefinition => ({
  name: OAUTH_IDENTITY_MODEL,
  schema: {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: userModel, required: true, index: true },
    provider: { type: String, required: true },
    /** The provider's own user id - never the e-mail, which can change. */
    providerUserId: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    lastLoginAt: { type: Date, default: Date.now },
  },
  indexes: [{ fields: { provider: 1, providerUserId: 1 }, unique: true }],
});

/** A pending passwordless sign-in link. Only a hash of the token is stored, and it deletes itself when it expires. */
export const magicLinkModel = (): ModelDefinition => ({
  name: MAGIC_LINK_MODEL,
  schema: {
    email: { type: String, required: true, lowercase: true, trim: true },
    tokenHash: { type: String, required: true, select: false },
    /** Hash of the cookie that ties the link to the browser that asked for it (login-CSRF protection). */
    bindingHash: { type: String, select: false },
    name: { type: String, maxlength: 100 },
    expiresAt: { type: Date, required: true },
    lastSentAt: { type: Date, default: Date.now },
  },
  indexes: [
    { fields: { email: 1 }, unique: true },
    { fields: { tokenHash: 1 } },
    { fields: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
});

/** A user's second factor (TOTP authenticator app) plus recovery codes. The secret is encrypted at rest. */
export const mfaFactorModel = (userModel: string): ModelDefinition => ({
  name: MFA_FACTOR_MODEL,
  schema: {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: userModel, required: true },
    enabled: { type: Boolean, default: false },
    /** Bumped on every change: updates are compare-and-set on it, so a code cannot be spent twice concurrently. */
    version: { type: Number, default: 0 },
    secret: { type: mongoose.Schema.Types.Mixed, select: false },
    /** A secret that was generated but not yet confirmed with a first valid code. */
    pendingSecret: { type: mongoose.Schema.Types.Mixed, select: false },
    /** Last accepted time step: a code can never be used twice. */
    lastUsedStep: { type: Number, default: -1 },
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    recoveryCodeHashes: { type: [String], select: false, default: [] },
  },
  indexes: [{ fields: { owner: 1 }, unique: true }],
});
