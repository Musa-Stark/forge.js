import type { Request, Response } from "express";
import { ErrorCode, UnauthorizedError } from "../errors/index.js";
import type { RouteContext } from "../core/RouteContext.js";
import type { Services } from "../core/Services.js";
import type { AuthService, AuthOutcome } from "./AuthService.js";
import type { OtpPurpose } from "./OtpService.js";

/** HTTP adapter for {@link AuthService}: reads requests, sets cookies, writes responses. */
export class AuthController {
  constructor(
    private readonly services: Services,
    private readonly auth: () => AuthService,
  ) {}

  private get fields() {
    return this.services.config.auth.fields;
  }

  /** `GET /auth/methods`: what the front-end can offer on its sign-in screen. */
  authMethods = async (_req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    const { auth, apiPrefix } = this.services.config;
    const base = `${apiPrefix}/${ctx.collection.route}`;
    this.services.responses.success(res, {
      message: "Sign-in methods fetched successfully.",
      data: {
        password: { signup: auth.signupMode, login: auth.loginMode },
        magicLink: auth.magicLink ? { sameDevice: auth.magicLink.sameDevice, allowSignup: auth.magicLink.allowSignup } : null,
        oauth: this.services.oauth.list().map((p) => ({ name: p.name, displayName: p.displayName, url: `${base}/oauth/${p.name}` })),
        mfa: auth.mfa ? { totp: true } : null,
      },
    });
  };

  signup = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    const body = ctx.parseBody(req.body);
    const mode = ctx.route.mode ?? this.services.config.auth.signupMode;
    this.respond(res, ctx, await this.auth().signup(body, mode, req), "Signed up successfully.");
  };

  login = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    const body = ctx.parseBody(req.body);
    const mode = ctx.route.mode ?? this.services.config.auth.loginMode;
    this.respond(res, ctx, await this.auth().login(body, mode, req), "Logged in successfully.");
  };

  verifyOTP = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    const body = ctx.parseBody(req.body);
    const outcome = await this.auth().verifyOtp(
      String(body[this.fields.email]),
      body[this.fields.purpose] as OtpPurpose,
      String(body[this.fields.otp]),
      req,
    );
    this.respond(res, ctx, outcome, "Verified successfully.");
  };

  resendOTP = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    const body = ctx.parseBody(req.body);
    await this.auth().resendOtp(String(body[this.fields.email]), body[this.fields.purpose] as OtpPurpose);
    this.services.responses.success(res, { message: "A new code has been sent." });
  };

  forgotPassword = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    const body = ctx.parseBody(req.body);
    await this.auth().forgotPassword(String(body[this.fields.email]));
    // Same answer whether or not the account exists.
    this.services.responses.success(res, { message: "If an account exists for this e-mail, a code has been sent." });
  };

  resetPassword = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    const body = ctx.parseBody(req.body);
    await this.auth().resetPassword(
      String(body[this.fields.email]),
      String(body.resetToken),
      String(body[this.fields.password]),
    );
    this.services.cookies.clear(res);
    this.services.responses.success(res, { message: "Password reset successfully. Please log in." });
  };

  refresh = async (req: Request, res: Response, _ctx: RouteContext): Promise<void> => {
    const result = await this.services.sessions.refresh(this.refreshTokenFrom(req), req);
    this.services.cookies.set(res, result);
    this.services.responses.success(res, {
      message: "Token refreshed successfully.",
      extra: this.services.sessionResponder.tokenBody({ accessToken: result.accessToken, ...(result.refreshToken ? { refreshToken: result.refreshToken } : {}) }),
    });
  };

  logout = async (req: Request, res: Response, _ctx: RouteContext): Promise<void> => {
    await this.services.sessions.revoke(this.refreshTokenFrom(req));
    this.services.cookies.clear(res);
    this.services.responses.success(res, { message: "Logged out successfully." });
  };

  private respond(res: Response, ctx: RouteContext, outcome: AuthOutcome, message: string): void {
    switch (outcome.kind) {
      case "code-sent":
        this.services.responses.success(res, { message: "A verification code has been sent to your e-mail." });
        return;
      case "reset-token":
        this.services.responses.success(res, {
          message: "Code verified. Use the reset token to set a new password.",
          extra: { resetToken: outcome.resetToken },
        });
        return;
      case "mfa-required":
      case "session":
        this.services.sessionResponder.sendLogin(res, outcome, { message, hiddenFields: ctx.route.config?.hiddenFields });
    }
  }

  private refreshTokenFrom(req: Request): string | undefined {
    const name = this.services.config.auth.refreshTokenName;
    const fromCookie = (req.cookies as Record<string, unknown> | undefined)?.[name];
    const fromBody = (req.body as Record<string, unknown> | undefined)?.[name];
    const value = fromCookie ?? fromBody;
    if (value !== undefined && typeof value !== "string") {
      throw new UnauthorizedError({ message: "The refresh token is invalid.", code: ErrorCode.REFRESH_TOKEN_INVALID });
    }
    return value;
  }
}
