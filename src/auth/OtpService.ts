import type { ForgeConfig } from "../config/ForgeConfig.js";
import { BadRequestError, ErrorCode, NotFoundError, TooManyRequestsError } from "../errors/index.js";
import { OTP_REQUEST_MODEL } from "../data/internalModels.js";
import type { DataSource, Doc } from "../data/Repository.js";
import type { EmailService } from "../email/EmailService.js";
import { hmacCode, randomNumericCode, randomToken, safeEqual, sha256 } from "../security/TokenService.js";
import type { Logger } from "../utils/Logger.js";

export type OtpPurpose = "signup" | "login" | "password_reset";
export const OTP_PURPOSES: readonly OtpPurpose[] = ["signup", "login", "password_reset"];

export interface IssueInput {
  email: string;
  purpose: OtpPurpose;
  /** Data to hand back after verification (e.g. the sign-up payload). */
  payload?: Record<string, unknown> | undefined;
  /** Name used in the greeting of the e-mail. */
  userName?: string | undefined;
}

const SUBJECTS: Record<OtpPurpose, string> = {
  signup: "Confirm your e-mail address",
  login: "Your login code",
  password_reset: "Reset your password",
};

/**
 * One-time codes for sign-up, login and password reset.
 *
 * Differences from 1.x: codes expire on their own (TTL index) instead of
 * blocking the user forever, wrong guesses are counted correctly, resend is
 * rate limited, codes are stored as keyed hashes, and password reset hands
 * out a separate single-use token rather than a reusable "verified" flag.
 */
export class OtpService {
  constructor(
    private readonly config: ForgeConfig,
    private readonly data: DataSource,
    private readonly emails: EmailService,
    private readonly logger: Logger,
  ) {}

  private get repo() {
    return this.data.repository(OTP_REQUEST_MODEL);
  }

  private key(): string {
    return `forge-otp:${this.config.jwtSecret ?? ""}`;
  }

  async issue(input: IssueInput): Promise<void> {
    const { otp } = this.config.auth;
    const email = input.email.toLowerCase();
    const existing = await this.repo.findOne({ email, purpose: input.purpose });
    const now = Date.now();

    if (existing && new Date(existing.expiresAt).getTime() > now) {
      const waitMs = new Date(existing.lastSentAt).getTime() + otp.resendCooldown.toMs() - now;
      if (waitMs > 0) {
        throw new TooManyRequestsError({
          message: "A code was sent recently. Please wait before requesting another.",
          code: ErrorCode.OTP_RESEND_COOLDOWN,
          headers: { "Retry-After": String(Math.ceil(waitMs / 1000)) },
          details: { retryAfterSeconds: Math.ceil(waitMs / 1000) },
        });
      }
      if (existing.resends >= otp.maxResends) {
        throw new TooManyRequestsError({
          message: "Too many codes were requested. Please try again later.",
          code: ErrorCode.OTP_RESEND_LIMIT,
        });
      }
    }

    const code = randomNumericCode(6);
    const record = {
      email,
      purpose: input.purpose,
      codeHash: hmacCode(code, this.key()),
      expiresAt: otp.expiresIn.fromNow(now),
      attempts: 0,
      lastSentAt: new Date(now),
      verifiedAt: null,
      resetTokenHash: null,
      resetExpiresAt: null,
    };

    if (existing) {
      await this.repo.updateById(existing._id, {
        ...record,
        resends: (existing.resends ?? 0) + 1,
        ...(input.payload ? { payload: input.payload } : {}),
      });
    } else {
      await this.repo.create({ ...record, resends: 0, ...(input.payload ? { payload: input.payload } : {}) });
    }

    await this.send(email, code, input);
  }

  /** Re-sends a code for a request that is already pending. */
  async resend(email: string, purpose: OtpPurpose, userName?: string): Promise<void> {
    const existing = await this.repo.findOne({ email: email.toLowerCase(), purpose });
    if (!existing) {
      throw new NotFoundError({
        message: "There is no pending request for this e-mail. Start again.",
        code: ErrorCode.OTP_NOT_FOUND,
      });
    }
    await this.issue({ email, purpose, userName });
  }

  /** Checks a code. On success a signup/login request is consumed and its payload returned. */
  async verify(email: string, purpose: OtpPurpose, code: string): Promise<{ record: Doc; resetToken?: string }> {
    const { otp } = this.config.auth;
    const record = await this.repo.findOne({ email: email.toLowerCase(), purpose }, { withSecrets: ["codeHash"] });
    if (!record) {
      throw new NotFoundError({ message: "No pending code was found. Request a new one.", code: ErrorCode.OTP_NOT_FOUND });
    }
    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      await this.repo.deleteById(record._id);
      throw new BadRequestError({ message: "The code has expired. Request a new one.", code: ErrorCode.OTP_EXPIRED });
    }
    if (record.attempts >= otp.maxAttempts) {
      await this.repo.deleteById(record._id);
      throw new TooManyRequestsError({
        message: "Too many wrong attempts. Request a new code.",
        code: ErrorCode.OTP_ATTEMPTS_EXCEEDED,
      });
    }

    const valid = typeof record.codeHash === "string" && safeEqual(record.codeHash, hmacCode(code, this.key()));
    if (!valid) {
      const attempts = record.attempts + 1;
      await this.repo.updateById(record._id, { attempts });
      throw new BadRequestError({
        message: "The code is incorrect.",
        code: ErrorCode.OTP_INVALID,
        details: { attemptsLeft: Math.max(0, otp.maxAttempts - attempts) },
      });
    }

    if (purpose !== "password_reset") {
      await this.repo.deleteById(record._id);
      return { record };
    }

    // Password reset: swap the code for a separate single-use token.
    const resetToken = randomToken(32);
    await this.repo.updateById(record._id, {
      verifiedAt: new Date(),
      codeHash: sha256(`used:${randomToken(8)}`),
      resetTokenHash: sha256(resetToken),
      resetExpiresAt: otp.verifiedWindow.fromNow(),
    });
    return { record, resetToken };
  }

  /** Validates and burns a password-reset token. */
  async consumeResetToken(email: string, resetToken: string): Promise<void> {
    const record = await this.repo.findOne(
      { email: email.toLowerCase(), purpose: "password_reset" },
      { withSecrets: ["resetTokenHash"] },
    );
    const valid =
      record &&
      typeof record.resetTokenHash === "string" &&
      record.resetExpiresAt &&
      new Date(record.resetExpiresAt).getTime() > Date.now() &&
      safeEqual(record.resetTokenHash, sha256(resetToken));

    if (!valid) {
      throw new BadRequestError({
        message: "The reset link is invalid or has expired. Start again.",
        code: ErrorCode.RESET_TOKEN_INVALID,
      });
    }
    await this.repo.deleteById(record._id);
  }

  private async send(email: string, code: string, input: IssueInput): Promise<void> {
    if (this.config.isOffline) {
      // Development only (isOffline is rejected in production): nothing is e-mailed, so show the code.
      this.logger.info(`[offline] ${input.purpose} code for ${email}: ${code}`);
    }
    await this.emails.sendTemplate({
      to: email,
      subject: SUBJECTS[input.purpose],
      template: "two-factor-code",
      placeholders: {
        otpCode: code,
        userName: input.userName ?? "there",
        userEmail: email,
        expiryMinutes: Math.max(1, Math.round(this.config.auth.otp.expiresIn.toMs() / 60_000)),
      },
    });
  }
}
