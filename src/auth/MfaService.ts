import { randomInt } from "node:crypto";
import type { ForgeConfig, ResolvedMfaConfig } from "../config/ForgeConfig.js";
import {
  AppError, BadRequestError, ConflictError, ErrorCode, TooManyRequestsError, UnauthorizedError, ValidationError,
} from "../errors/index.js";
import { MFA_FACTOR_MODEL } from "../data/internalModels.js";
import type { DataSource, Doc, Repository } from "../data/Repository.js";
import type { CryptoVault, SealedValue } from "../security/CryptoVault.js";
import { safeEqual, sha256, type TokenService } from "../security/TokenService.js";
import { Totp } from "../security/Totp.js";

/** What a user types to prove the second factor: an authenticator code, or one of their recovery codes. */
export interface SecondFactorInput {
  code?: string | undefined;
  recoveryCode?: string | undefined;
}

export interface SetupResult {
  /** Base32 secret for manual entry. Shown once. */
  secret: string;
  /** `otpauth://` URI: render it as a QR code. */
  otpauthUrl: string;
  issuer: string;
}

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
const RECOVERY_LENGTH = 12;

/** Normalises what a person typed: case, spaces and dashes do not matter. */
const normaliseRecovery = (value: string): string => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Authenticator-app (TOTP) second factor with recovery codes.
 *
 * - The secret is encrypted with the master key (it must be readable to check codes).
 * - A code works once: the accepted time step is stored and only newer steps are accepted.
 * - Wrong codes are counted per account; too many lock the second factor for a while,
 *   which stops a distributed guess of the 6 digits that per-IP limits cannot.
 * - Every state change is a compare-and-set on `version`, so two simultaneous requests cannot both
 *   spend the same code.
 */
export class MfaService {
  private readonly totp: Totp;

  constructor(
    private readonly config: ForgeConfig,
    private readonly data: DataSource,
    private readonly vault: CryptoVault,
    private readonly tokens: TokenService,
  ) {
    this.totp = new Totp({ window: this.settings.window });
  }

  private get settings(): ResolvedMfaConfig {
    return this.config.auth.mfa as ResolvedMfaConfig;
  }

  private get factors(): Repository {
    return this.data.repository(MFA_FACTOR_MODEL);
  }

  async isEnabled(userId: string): Promise<boolean> {
    return Boolean((await this.factors.findOne({ owner: userId }))?.enabled);
  }

  async status(userId: string): Promise<{ enabled: boolean; recoveryCodesRemaining: number }> {
    const factor = await this.factors.findOne({ owner: userId }, { withSecrets: ["recoveryCodeHashes"] });
    return {
      enabled: Boolean(factor?.enabled),
      recoveryCodesRemaining: factor?.enabled ? ((factor.recoveryCodeHashes as string[] | undefined) ?? []).length : 0,
    };
  }

  /** Step 1: create a pending secret. Nothing is protected until {@link confirmSetup} succeeds. */
  async beginSetup(userId: string, account: string): Promise<SetupResult> {
    const existing = await this.factors.findOne({ owner: userId });
    if (existing?.enabled) {
      throw new ConflictError({ message: "Two-factor authentication is already enabled.", code: ErrorCode.MFA_ALREADY_ENABLED });
    }

    const secret = Totp.generateSecret();
    const pendingSecret = await this.vault.seal(secret);
    if (existing) await this.factors.updateById(existing._id, { pendingSecret });
    else await this.factors.create({ owner: userId, pendingSecret });

    return { secret, issuer: this.settings.issuer, otpauthUrl: this.totp.otpauthUrl({ secret, issuer: this.settings.issuer, account }) };
  }

  /** Step 2: the user proves their app works by entering a code. Activates the factor and returns the recovery codes (once). */
  async confirmSetup(userId: string, code: string): Promise<string[]> {
    const factor = await this.factors.findOne({ owner: userId }, { withSecrets: ["pendingSecret", "secret"] });
    if (factor?.enabled) {
      throw new ConflictError({ message: "Two-factor authentication is already enabled.", code: ErrorCode.MFA_ALREADY_ENABLED });
    }
    if (!factor?.pendingSecret) {
      throw new BadRequestError({ message: "Start the setup first.", code: ErrorCode.MFA_SETUP_REQUIRED });
    }
    this.assertNotLocked(factor);

    const step = this.totp.verify(await this.vault.unseal(factor.pendingSecret as SealedValue), code);
    if (step === undefined) throw await this.recordFailure(factor);

    const { codes, hashes } = this.newRecoveryCodes();
    const won = await this.commit(factor, {
      enabled: true,
      secret: factor.pendingSecret,
      pendingSecret: null,
      lastUsedStep: step,
      recoveryCodeHashes: hashes,
      failedAttempts: 0,
      lockedUntil: null,
    });
    if (!won) throw this.invalid();
    return codes;
  }

  /** Checks the second-factor step of a sign-in and returns the user it belongs to. */
  async verifyChallenge(mfaToken: string | undefined, input: SecondFactorInput): Promise<string> {
    const claims = this.tokens.verifyMfaChallenge(mfaToken);
    await this.verifySecondFactor(claims.sub, input);
    return claims.sub;
  }

  /** Verifies a code or recovery code for a user whose factor is enabled. Throws on failure. */
  async verifySecondFactor(userId: string, input: SecondFactorInput): Promise<void> {
    const factor = await this.factors.findOne({ owner: userId }, { withSecrets: ["secret", "recoveryCodeHashes"] });
    if (!factor?.enabled || !factor.secret) {
      throw new ConflictError({ message: "Two-factor authentication is not enabled.", code: ErrorCode.MFA_NOT_ENABLED });
    }
    this.assertNotLocked(factor);

    if (input.code !== undefined) {
      const step = this.totp.verify(await this.vault.unseal(factor.secret as SealedValue), input.code, { afterStep: factor.lastUsedStep as number });
      if (step === undefined) throw await this.recordFailure(factor);
      const won = await this.commit(factor, { lastUsedStep: step, failedAttempts: 0, lockedUntil: null });
      if (!won) throw this.invalid(); // the same code was spent by a concurrent request
      return;
    }

    if (input.recoveryCode !== undefined) {
      const wanted = sha256(normaliseRecovery(input.recoveryCode));
      const hashes = (factor.recoveryCodeHashes as string[] | undefined) ?? [];
      // Compare against every stored hash (no early exit) so timing does not reveal how close a guess was.
      const index = hashes.reduce((found, hash, i) => (safeEqual(hash, wanted) ? i : found), -1);
      if (index === -1) throw await this.recordFailure(factor);
      const won = await this.commit(factor, { recoveryCodeHashes: hashes.filter((_, i) => i !== index), failedAttempts: 0, lockedUntil: null });
      if (!won) throw this.invalid();
      return;
    }

    throw new ValidationError({ message: "Provide either 'code' or 'recoveryCode'.", code: ErrorCode.MFA_CODE_INVALID });
  }

  /** Turns the second factor off (requires a valid code or recovery code). */
  async disable(userId: string, input: SecondFactorInput): Promise<void> {
    await this.verifySecondFactor(userId, input);
    await this.factors.deleteMany({ owner: userId });
  }

  /** Replaces all recovery codes with a fresh set (requires a valid code or recovery code). */
  async regenerateRecoveryCodes(userId: string, input: SecondFactorInput): Promise<string[]> {
    await this.verifySecondFactor(userId, input);
    const factor = await this.factors.findOne({ owner: userId });
    const { codes, hashes } = this.newRecoveryCodes();
    await this.factors.updateById((factor as Doc)._id, { recoveryCodeHashes: hashes });
    return codes;
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** Optimistic lock: applies `changes` only if nobody changed the factor since it was read. */
  private async commit(factor: Doc, changes: Record<string, unknown>): Promise<boolean> {
    const version = (factor.version as number | undefined) ?? 0;
    const updated = await this.factors.updateMany({ _id: factor._id, version }, { ...changes, version: version + 1 });
    return updated === 1;
  }

  private assertNotLocked(factor: Doc): void {
    const until = factor.lockedUntil ? new Date(factor.lockedUntil as string | Date).getTime() : 0;
    if (until > Date.now()) {
      const seconds = Math.ceil((until - Date.now()) / 1000);
      throw new TooManyRequestsError({
        message: "Too many wrong codes. Try again later.",
        code: ErrorCode.MFA_LOCKED,
        headers: { "Retry-After": String(seconds) },
        details: { retryAfterSeconds: seconds },
      });
    }
  }

  private async recordFailure(factor: Doc): Promise<AppError> {
    const failed = ((factor.failedAttempts as number | undefined) ?? 0) + 1;
    const locking = failed >= this.settings.maxAttempts;
    await this.commit(factor, {
      failedAttempts: locking ? 0 : failed,
      lockedUntil: locking ? this.settings.lockoutDuration.fromNow() : null,
    });
    if (locking) {
      // Same status and code as every later attempt during the lock.
      const seconds = Math.ceil(this.settings.lockoutDuration.toSeconds());
      return new TooManyRequestsError({
        message: "Too many wrong codes. The second factor is locked for a while.",
        code: ErrorCode.MFA_LOCKED,
        headers: { "Retry-After": String(seconds) },
        details: { retryAfterSeconds: seconds },
      });
    }
    return new UnauthorizedError({
      message: "The code is incorrect.",
      code: ErrorCode.MFA_CODE_INVALID,
      details: { attemptsLeft: this.settings.maxAttempts - failed },
    });
  }

  private invalid(): UnauthorizedError {
    return new UnauthorizedError({ message: "The code is incorrect or was already used.", code: ErrorCode.MFA_CODE_INVALID });
  }

  private newRecoveryCodes(): { codes: string[]; hashes: string[] } {
    const codes = Array.from({ length: this.settings.recoveryCodes }, () => {
      const raw = Array.from({ length: RECOVERY_LENGTH }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join("");
      return raw.match(/.{4}/g)!.join("-");
    });
    return { codes, hashes: codes.map((c) => sha256(normaliseRecovery(c))) };
  }
}
