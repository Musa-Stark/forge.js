import type { Request, Response } from "express";
import type { RouteContext } from "../core/RouteContext.js";
import type { Services } from "../core/Services.js";
import { randomToken } from "../security/TokenService.js";
import { MAGIC_BINDING_COOKIE } from "./CookieWriter.js";
import type { MagicLinkService } from "./MagicLinkService.js";

/** What a binding we issued looks like: anything else is ignored rather than trusted. */
const BINDING_SHAPE = /^[A-Za-z0-9_-]{16,64}$/;

/** HTTP adapter for {@link MagicLinkService}. */
export class MagicLinkController {
  constructor(
    private readonly services: Services,
    private readonly magic: () => MagicLinkService,
  ) {}

  private get settings() {
    return this.services.config.auth.magicLink!;
  }

  /** `POST /auth/magic-link` `{ email, name? }` - always the same answer. */
  magicLinkRequest = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    const body = ctx.parseBody(req.body);
    const email = String(body[this.services.config.auth.fields.email]);

    // The binding is a per-browser secret: keep the one this browser already has, so asking again ("resend")
    // does not invalidate the link that is already in the inbox. Always (re)set it - even when nothing is sent -
    // so the response never reveals whether an e-mail went out.
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const existing = cookies?.[MAGIC_BINDING_COOKIE];
    const binding = typeof existing === "string" && BINDING_SHAPE.test(existing) ? existing : randomToken(16);
    this.services.cookies.setMagicBinding(res, binding, this.settings.expiresIn.toMs());

    await this.magic().request(email, { name: typeof body.name === "string" ? body.name : undefined, binding });
    this.services.responses.success(res, { message: "If this address can sign in, a link is on its way." });
  };

  /** `POST /auth/magic-link/verify` `{ token }` - called by the front-end page the link opens. */
  magicLinkVerify = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    const body = ctx.parseBody(req.body);
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const binding = cookies?.[MAGIC_BINDING_COOKIE];

    res.setHeader("Cache-Control", "no-store");
    const result = await this.magic().verify(String(body.token), typeof binding === "string" ? binding : undefined, req);
    this.services.cookies.clearMagicBinding(res);
    this.services.sessionResponder.sendLogin(res, result, { message: "Signed in successfully.", hiddenFields: ctx.route.config?.hiddenFields });
  };
}
