import type { Request, Response } from "express";
import { AppError, ErrorTranslator } from "../errors/index.js";
import { OAUTH_STATE_COOKIE } from "../auth/CookieWriter.js";
import type { RouteContext } from "../core/RouteContext.js";
import type { Services } from "../core/Services.js";
import type { OAuthService } from "./OAuthService.js";
import { safeReturnPath } from "./returnPath.js";

/** HTTP adapter for {@link OAuthService}: three routes - list providers, start, callback. */
export class OAuthController {
  private readonly translator = new ErrorTranslator();

  constructor(
    private readonly services: Services,
    private readonly oauth: () => OAuthService,
  ) {}

  private get settings() {
    return this.services.config.auth.oauth;
  }

  /** `GET /auth/oauth/providers`: lets the front-end render the right buttons. */
  oauthProviders = async (_req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    const base = `${this.services.config.apiPrefix}/${ctx.collection.route}/oauth`;
    this.services.responses.success(res, {
      message: "Sign-in providers fetched successfully.",
      data: this.services.oauth.list().map((p) => ({ name: p.name, displayName: p.displayName, url: `${base}/${p.name}` })),
    });
  };

  /** `GET /auth/oauth/:provider`: remember the state in a cookie, then send the browser to the provider. */
  oauthStart = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    const name = String(req.params.provider);
    const { url, stateToken } = this.oauth().begin(name, this.callbackUrl(ctx, name), safeReturnPath(req.query.returnTo));

    this.services.cookies.setOAuthState(res, stateToken, this.settings!.stateAge.toMs());
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, url);
  };

  /** `GET /auth/oauth/:provider/callback`: the provider sends the browser back here. */
  oauthCallback = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    const name = String(req.params.provider);
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const stateToken = cookies?.[OAUTH_STATE_COOKIE];
    res.setHeader("Cache-Control", "no-store");

    try {
      const outcome = await this.oauth().complete(
        {
          provider: name,
          code: req.query.code,
          state: req.query.state,
          error: req.query.error,
          stateToken: typeof stateToken === "string" ? stateToken : undefined,
          redirectUri: this.callbackUrl(ctx, name),
        },
        req,
      );
      // The state is single-use: whatever happens next, this browser starts fresh.
      this.services.cookies.clearOAuthState(res);

      const target = this.successTarget(outcome.returnTo);
      if (target) {
        this.services.sessionResponder.establish(res, outcome.tokens);
        res.redirect(302, target);
        return;
      }
      this.services.sessionResponder.send(res, {
        user: outcome.user,
        tokens: outcome.tokens,
        created: outcome.created,
        message: `Signed in with ${this.services.oauth.get(name).displayName}.`,
        hiddenFields: ctx.route.config?.hiddenFields,
      });
    } catch (error) {
      this.services.cookies.clearOAuthState(res);
      const failureRedirect = this.settings?.failureRedirect;
      if (!failureRedirect) throw error;

      // Redirect mode: the browser cannot show a JSON error, so hand the front-end a short code.
      const appError: AppError = this.translator.translate(error);
      if (appError.statusCode >= 500) this.services.logger.error(`OAuth callback failed: ${appError.message}`, { code: appError.code });
      const url = new URL(failureRedirect);
      url.searchParams.set("error", appError.code);
      res.redirect(302, url.toString());
    }
  };

  private callbackUrl(ctx: RouteContext, provider: string): string {
    const base = this.services.config.backendURL.replace(/\/+$/, "");
    return `${base}/${ctx.collection.route}/oauth/${encodeURIComponent(provider)}/callback`;
  }

  private successTarget(returnTo: string | undefined): string | undefined {
    const base = this.settings?.successRedirect;
    if (!base) return undefined;
    // `returnTo` was validated as a plain path, so this can only stay on the configured front-end.
    return returnTo ? new URL(returnTo, base).toString() : base;
  }
}
