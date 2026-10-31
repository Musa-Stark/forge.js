import type { Request, Response } from "express";
import { ErrorCode, NotFoundError, ValidationError } from "../errors/index.js";
import type { RouteContext } from "../core/RouteContext.js";
import type { Services } from "../core/Services.js";
import type { LoginCompleter } from "./LoginCompleter.js";
import type { MfaService, SecondFactorInput } from "./MfaService.js";

/** HTTP adapter for {@link MfaService}: status, setup, activation, the sign-in challenge, disabling, recovery codes. */
export class MfaController {
  constructor(
    private readonly services: Services,
    private readonly mfa: () => MfaService,
    private readonly completer: () => LoginCompleter,
  ) {}

  private userId(req: Request): string {
    return req.user!._id;
  }

  mfaStatus = async (req: Request, res: Response, _ctx: RouteContext): Promise<void> => {
    this.services.responses.success(res, { message: "Two-factor status fetched successfully.", data: await this.mfa().status(this.userId(req)) });
  };

  /** Step 1 of enrolment: returns the secret and the `otpauth://` URL to show as a QR code. */
  mfaSetup = async (req: Request, res: Response, _ctx: RouteContext): Promise<void> => {
    const user = await this.services.data.repository(this.services.userModel!).findById(this.userId(req));
    if (!user) throw new NotFoundError({ message: "Account not found.", code: ErrorCode.USER_NOT_FOUND });

    const account = String(user[this.services.config.auth.fields.email] ?? user._id);
    res.setHeader("Cache-Control", "no-store");
    this.services.responses.success(res, { message: "Scan the code with your authenticator app, then confirm it.", data: await this.mfa().beginSetup(user._id, account) });
  };

  /** Step 2: confirm with a code from the app. The recovery codes are returned once. */
  mfaEnable = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    const body = ctx.parseBody(req.body);
    res.setHeader("Cache-Control", "no-store");
    const recoveryCodes = await this.mfa().confirmSetup(this.userId(req), String(body.code));
    this.services.responses.success(res, {
      message: "Two-factor authentication is on. Store the recovery codes somewhere safe: they are shown only once.",
      data: { enabled: true, recoveryCodes },
    });
  };

  /** The second step of a sign-in: `{ mfaToken, code }` or `{ mfaToken, recoveryCode }`. */
  mfaVerify = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    const body = ctx.parseBody(req.body);
    res.setHeader("Cache-Control", "no-store");

    const userId = await this.mfa().verifyChallenge(typeof body.mfaToken === "string" ? body.mfaToken : undefined, this.input(body));
    const user = await this.services.data.repository(this.services.userModel!).findById(userId);
    if (!user) throw new NotFoundError({ message: "Account not found.", code: ErrorCode.USER_NOT_FOUND });

    const result = await this.completer().startSession(user, req);
    this.services.sessionResponder.sendLogin(res, result, { message: "Signed in successfully.", hiddenFields: ctx.route.config?.hiddenFields });
  };

  mfaDisable = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    await this.mfa().disable(this.userId(req), this.input(ctx.parseBody(req.body)));
    this.services.responses.success(res, { message: "Two-factor authentication is off.", data: { enabled: false } });
  };

  mfaRecoveryCodes = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const recoveryCodes = await this.mfa().regenerateRecoveryCodes(this.userId(req), this.input(ctx.parseBody(req.body)));
    this.services.responses.success(res, { message: "New recovery codes created. The old ones no longer work.", data: { recoveryCodes } });
  };

  /** Exactly one of `code` / `recoveryCode`. */
  private input(body: Record<string, unknown>): SecondFactorInput {
    const code = typeof body.code === "string" && body.code !== "" ? body.code : undefined;
    const recoveryCode = typeof body.recoveryCode === "string" && body.recoveryCode !== "" ? body.recoveryCode : undefined;
    if ((code === undefined) === (recoveryCode === undefined)) {
      throw new ValidationError({ message: "Provide either 'code' or 'recoveryCode'.", code: ErrorCode.VALIDATION_FAILED });
    }
    return { code, recoveryCode };
  }
}
