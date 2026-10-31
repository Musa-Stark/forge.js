import type { Response } from "express";
import type { ForgeConfig } from "../config/ForgeConfig.js";
import type { SessionTokens } from "./SessionService.js";

export const OAUTH_STATE_COOKIE = "forge_oauth_state";
export const MAGIC_BINDING_COOKIE = "forge_magic_binding";

/** Sets and clears the HttpOnly session cookies with one consistent set of attributes. */
export class CookieWriter {
  constructor(private readonly config: ForgeConfig) {}

  private base() {
    const { cookie } = this.config.auth;
    return {
      httpOnly: true,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
      ...(cookie.domain ? { domain: cookie.domain } : {}),
    } as const;
  }

  set(res: Response, tokens: Partial<SessionTokens>): void {
    const { auth } = this.config;
    if (tokens.accessToken) {
      res.cookie(auth.accessTokenName, tokens.accessToken, { ...this.base(), maxAge: auth.accessTokenAge.toMs() });
    }
    if (tokens.refreshToken) {
      res.cookie(auth.refreshTokenName, tokens.refreshToken, { ...this.base(), maxAge: auth.refreshTokenAge.toMs() });
    }
  }

  /**
   * Holds the signed OAuth state during the provider round-trip. Always `SameSite=Lax`: the provider
   * sends the browser back with a top-level GET, which `Strict` would drop and `None` would over-share.
   */
  setOAuthState(res: Response, value: string, maxAgeMs: number): void {
    res.cookie(OAUTH_STATE_COOKIE, value, { ...this.base(), sameSite: "lax", maxAge: maxAgeMs });
  }

  /**
   * Ties a magic link to the browser that requested it. Uses the configured session-cookie attributes (not forced to
   * Lax) because the link is redeemed by a `fetch` from the front-end, which may be on another site.
   */
  setMagicBinding(res: Response, value: string, maxAgeMs: number): void {
    res.cookie(MAGIC_BINDING_COOKIE, value, { ...this.base(), maxAge: maxAgeMs });
  }

  clearMagicBinding(res: Response): void {
    res.clearCookie(MAGIC_BINDING_COOKIE, this.base());
  }

  clearOAuthState(res: Response): void {
    res.clearCookie(OAUTH_STATE_COOKIE, { ...this.base(), sameSite: "lax" });
  }

  clear(res: Response): void {
    res.clearCookie(this.config.auth.accessTokenName, this.base());
    res.clearCookie(this.config.auth.refreshTokenName, this.base());
  }
}
