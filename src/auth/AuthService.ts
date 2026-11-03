import type { Request } from "express";
import type { ForgeConfig } from "../config/ForgeConfig.js";
import {
  ConflictError,
  ErrorCode,
  UnauthorizedError,
} from "../errors/index.js";
import type { DataSource, Doc, Repository } from "../data/Repository.js";
import type { PasswordHasher } from "../security/PasswordHasher.js";
import { omitKeys } from "../utils/sanitizeInput.js";
import { AppError } from "../errors/index.js";
import type { OtpPurpose, OtpService } from "./OtpService.js";
import type { LoginCompleter, LoginResult } from "./LoginCompleter.js";
import type { SessionService } from "./SessionService.js";

export type AuthOutcome =
  | LoginResult
  | { kind: "code-sent" }
  | { kind: "reset-token"; resetToken: string };

/** The authentication use cases. Knows nothing about HTTP responses. */
export class AuthService {
  constructor(
    private readonly config: ForgeConfig,
    private readonly data: DataSource,
    private readonly userModel: string,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionService,
    private readonly otp: OtpService,
    private readonly completer: LoginCompleter,
  ) {}

  private get users(): Repository {
    return this.data.repository(this.userModel);
  }

  private get fields() {
    return this.config.auth.fields;
  }

  async signup(
    body: Record<string, unknown>,
    mode: "credentials" | "otp",
    req: Request,
  ): Promise<AuthOutcome> {
    const email = this.emailOf(body);
    if (await this.users.findOne({ [this.fields.email]: email })) {
      throw new ConflictError({
        message: "An account with this e-mail already exists.",
        code: ErrorCode.USER_ALREADY_EXISTS,
      });
    }

    const data = await this.prepareNewUser(body);
    if (mode === "credentials") {
      const user = await this.users.create(data);
      return {
        kind: "session",
        user,
        tokens: await this.sessions.start(user._id, req),
        created: true,
      };
    }

    await this.otp.issue({
      email,
      purpose: "signup",
      payload: data,
      userName: this.nameOf(body),
    });
    return { kind: "code-sent" };
  }

  async login(
    body: Record<string, unknown>,
    mode: "credentials" | "otp",
    req: Request,
  ): Promise<AuthOutcome> {
    const user = await this.checkCredentials(
      this.emailOf(body),
      String(body[this.fields.password] ?? ""),
    );

    if (mode === "credentials") return this.completer.complete(user, req);
    await this.otp.issue({
      email: this.emailOf(body),
      purpose: "login",
      userName: this.nameOf(user),
    });
    return { kind: "code-sent" };
  }

  async verifyOtp(
    email: string,
    purpose: OtpPurpose,
    code: string,
    req: Request,
  ): Promise<AuthOutcome> {
    const { record, resetToken } = await this.otp.verify(email, purpose, code);

    if (purpose === "password_reset")
      return { kind: "reset-token", resetToken: resetToken as string };

    if (purpose === "signup") {
      const payload = (record.payload ?? {}) as Record<string, unknown>;
      const user = await this.users.create(payload);
      return {
        kind: "session",
        user,
        tokens: await this.sessions.start(user._id, req),
        created: true,
      };
    }

    const user = await this.users.findOne({
      [this.fields.email]: email.toLowerCase(),
    });
    if (!user)
      throw new UnauthorizedError({
        message: "Invalid credentials.",
        code: ErrorCode.INVALID_CREDENTIALS,
      });
    return this.completer.complete(user, req);
  }

  async resendOtp(email: string, purpose: OtpPurpose): Promise<void> {
    await this.otp.resend(email, purpose);
  }

  /** Always succeeds from the caller's point of view, so it cannot be used to discover registered e-mails. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findOne({
      [this.fields.email]: email.toLowerCase(),
    });
    if (!user) return;
    try {
      await this.otp.issue({
        email,
        purpose: "password_reset",
        userName: this.nameOf(user),
      });
    } catch (error) {
      const swallow = [
        ErrorCode.OTP_RESEND_COOLDOWN,
        ErrorCode.OTP_RESEND_LIMIT,
      ] as string[];
      if (!(error instanceof AppError && swallow.includes(error.code)))
        throw error;
    }
  }

  async resetPassword(
    email: string,
    resetToken: string,
    newPassword: string,
  ): Promise<void> {
    await this.otp.consumeResetToken(email, resetToken);
    const user = await this.users.findOne({
      [this.fields.email]: email.toLowerCase(),
    });
    if (!user) {
      throw new UnauthorizedError({
        message: "The reset link is invalid or has expired.",
        code: ErrorCode.RESET_TOKEN_INVALID,
      });
    }
    await this.users.updateById(user._id, {
      [this.fields.password]: await this.hasher.hash(newPassword),
    });
    await this.sessions.revokeAll(user._id);
  }

  /** Verifies e-mail + password with the same error and timing for "no such user" and "wrong password". */
  async checkCredentials(email: string, password: string): Promise<Doc> {
    const user = await this.users.findOne(
      { [this.fields.email]: email },
      { withSecrets: [this.fields.password] },
    );
    const stored = user?.[this.fields.password] as string | undefined;

    if (!user || !stored) {
      await this.hasher.verifyAgainstDummy(password);
      throw this.invalidCredentials();
    }
    if (!(await this.hasher.verify(password, stored)))
      throw this.invalidCredentials();

    if (await this.hasher.needsRehash(stored)) {
      await this.users.updateById(user._id, {
        [this.fields.password]: await this.hasher.hash(password),
      });
    }
    return user;
  }

  private async prepareNewUser(
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    // Roles and other privileged fields can never be chosen during sign-up.
    const safe = omitKeys(body, this.config.protectedFields) as Record<
      string,
      unknown
    >;
    return {
      ...safe,
      [this.fields.password]: await this.hasher.hash(
        String(body[this.fields.password]),
      ),
    };
  }

  private emailOf(body: Record<string, unknown>): string {
    return String(body[this.fields.email]).toLowerCase();
  }

  private nameOf(source: Record<string, unknown>): string | undefined {
    const name = source.name ?? source.firstName ?? source.username;
    return typeof name === "string" && name ? name : undefined;
  }

  private invalidCredentials(): UnauthorizedError {
    return new UnauthorizedError({
      message: "Invalid e-mail or password.",
      code: ErrorCode.INVALID_CREDENTIALS,
    });
  }
}
