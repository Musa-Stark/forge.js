import type { Request } from "express";
import type { ForgeConfig } from "../config/ForgeConfig.js";
import type { Doc } from "../data/Repository.js";
import type { TokenService } from "../security/TokenService.js";
import type { MfaService } from "./MfaService.js";
import type { SessionService, SessionTokens } from "./SessionService.js";

export type LoginResult =
  | { kind: "session"; user: Doc; tokens: SessionTokens; created: boolean }
  /** The first factor succeeded, but a second one is required before any session exists. */
  | { kind: "mfa-required"; mfaToken: string };

/**
 * The single exit of every *first-factor* sign-in (password, e-mailed code, magic link).
 *
 * Whatever proved who the user is, this decides whether a session starts now or a second factor
 * (authenticator code) comes first. Because all methods end here, a new sign-in method cannot forget
 * the second-factor check. (Social sign-in relies on the provider's own protections and does not pass here.)
 */
export class LoginCompleter {
  constructor(
    private readonly config: ForgeConfig,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly mfa: () => MfaService | undefined,
  ) {}

  async complete(user: Doc, req: Request, options: { created?: boolean } = {}): Promise<LoginResult> {
    const settings = this.config.auth.mfa;
    // A brand-new account cannot have a second factor yet.
    if (settings && !options.created && (await this.mfa()?.isEnabled(user._id))) {
      return { kind: "mfa-required", mfaToken: this.tokens.signMfaChallenge(user._id, settings.challengeAge) };
    }
    return this.startSession(user, req, options.created ?? false);
  }

  /** Starts a session unconditionally. Only call it after every required factor was checked. */
  async startSession(user: Doc, req: Request, created = false): Promise<LoginResult> {
    return { kind: "session", user, tokens: await this.sessions.start(user._id, req), created };
  }
}
