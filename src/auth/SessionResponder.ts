import type { Response } from "express";
import type { ForgeConfig } from "../config/ForgeConfig.js";
import type { ResponseSanitizer } from "../core/ResponseSanitizer.js";
import type { Doc } from "../data/Repository.js";
import type { ResponseWriter } from "../http/ResponseWriter.js";
import type { CookieWriter } from "./CookieWriter.js";
import type { LoginResult } from "./LoginCompleter.js";
import type { SessionTokens } from "./SessionService.js";

export interface SessionResponse {
  user: Doc;
  tokens: SessionTokens;
  created: boolean;
  message: string;
  hiddenFields?: readonly string[] | undefined;
}

/** Sets the session cookies and writes the "you are signed in" response. Shared by every way of signing in. */
export class SessionResponder {
  constructor(
    private readonly config: ForgeConfig,
    private readonly cookies: CookieWriter,
    private readonly sanitizer: ResponseSanitizer,
    private readonly responses: ResponseWriter,
  ) {}

  /** Answers the outcome of a first-factor sign-in: a session, or "a second factor is needed". */
  sendLogin(res: Response, result: LoginResult, options: { message: string; hiddenFields?: readonly string[] | undefined }): void {
    if (result.kind === "mfa-required") {
      this.responses.success(res, {
        message: "Enter the code from your authenticator app to finish signing in.",
        extra: { mfaRequired: true, mfaToken: result.mfaToken },
      });
      return;
    }
    this.send(res, { user: result.user, tokens: result.tokens, created: result.created, ...options });
  }

  /** Cookies only (used when the browser is about to be redirected). */
  establish(res: Response, tokens: SessionTokens): void {
    this.cookies.set(res, tokens);
  }

  send(res: Response, input: SessionResponse): void {
    this.establish(res, input.tokens);
    const body = {
      message: input.message,
      data: this.sanitizer.one(input.user, { hiddenFields: input.hiddenFields }),
      extra: this.tokenBody(input.tokens),
    };
    if (input.created) this.responses.created(res, body);
    else this.responses.success(res, body);
  }

  /** Tokens are included in the JSON body only when explicitly enabled (for mobile / non-cookie clients). */
  tokenBody(tokens: { accessToken?: string; refreshToken?: string }): Record<string, unknown> {
    const { auth } = this.config;
    return {
      ...(auth.returnAccessToken && tokens.accessToken ? { [auth.accessTokenName]: tokens.accessToken } : {}),
      ...(auth.returnRefreshToken && tokens.refreshToken ? { [auth.refreshTokenName]: tokens.refreshToken } : {}),
    };
  }
}
