import type { ForgeConfig } from "../config/ForgeConfig.js";
import { BadRequestError, ErrorCode } from "../errors/index.js";
import type { ActionContext, EmailAction } from "../types/ActionHandler.js";
import { stripNewlines } from "../utils/html.js";
import type { EmailProvider } from "./EmailProvider.js";
import { AutoFields } from "./utils/AutoFields.js";
import { TemplateRenderer, templateConfigKey } from "./TemplateRenderer.js";

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const SENDER = /^[^<>\r\n]+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/;

export interface SendTemplateInput {
  to: string;
  subject: string;
  template: string;
  placeholders: Record<string, unknown>;
  from?: string;
}

/** Validates, renders and sends e-mails through the configured {@link EmailProvider}. */
export class EmailService {
  constructor(
    private readonly config: ForgeConfig,
    private readonly provider: EmailProvider,
    private readonly renderer: TemplateRenderer = new TemplateRenderer(),
    private readonly autoFields: AutoFields = new AutoFields(),
  ) {}

  /** Send a built-in template (used by the OTP flow). */
  async sendTemplate(input: SendTemplateInput): Promise<void> {
    const html = await this.renderer.render(input.template, {
      ...this.config.email,
      currentYear: new Date().getFullYear(),
      ...input.placeholders,
    });
    await this.deliver({ from: input.from ?? "system-email-sender", to: input.to, subject: input.subject, html });
  }

  /** Executes an `emailAction` declared on a route. */
  async sendAction(action: EmailAction["emailAction"], context: ActionContext): Promise<void> {
    const to = typeof action.to === "function" ? await action.to(context) : action.to;
    const subject = typeof action.subject === "function" ? action.subject(context) : action.subject;

    let html: string;
    if (action.type === "template") {
      if (!action.template?.name) {
        throw new BadRequestError({
          message: "emailAction: a template name is required when type is 'template'.",
          code: ErrorCode.EMAIL_ACTION_INVALID,
        });
      }
      const key = templateConfigKey(action.template.name);
      const own = (action.template as unknown as Record<string, Record<string, unknown> | undefined>)[key] ?? {};
      const resolved = await this.resolvePlaceholders(own, context);
      html = await this.renderer.render(action.template.name, {
        ...this.config.email,
        ...resolved,
        ...this.autoFields.derive(context.req),
      });
    } else {
      if (!action.rawBody) {
        throw new BadRequestError({
          message: "emailAction: rawBody is required when type is 'raw'.",
          code: ErrorCode.EMAIL_ACTION_INVALID,
        });
      }
      html = action.rawBody;
    }

    await this.deliver({ from: action.from, to, subject, html });
  }

  private async deliver(email: { from: string; to: string; subject: string; html: string }): Promise<void> {
    const from = email.from === "system-email-sender" ? this.config.systemEmailSender : email.from;
    if (!from || !SENDER.test(from)) {
      throw new BadRequestError({
        message: "Invalid e-mail sender.",
        code: ErrorCode.INVALID_EMAIL_SENDER,
        hint: "Use the format 'Starklabs <noreply@starklabs.com>' for 'from' or 'systemEmailSender'.",
      });
    }
    if (typeof email.to !== "string" || !EMAIL.test(email.to)) {
      throw new BadRequestError({
        message: "Invalid e-mail recipient.",
        code: ErrorCode.INVALID_EMAIL_RECIPIENT,
        hint: "'to' must be a valid e-mail address, or a function returning one.",
      });
    }
    const subject = stripNewlines(email.subject ?? "");
    if (!subject) {
      throw new BadRequestError({ message: "An e-mail subject is required.", code: ErrorCode.EMAIL_ACTION_INVALID });
    }
    await this.provider.send({ from, to: email.to, subject, html: email.html });
  }

  /** Resolves function placeholders and the `current-date` / `current-time` keywords (without mutating the config). */
  private async resolvePlaceholders(
    source: Record<string, unknown>,
    context: ActionContext,
  ): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(source)) {
      if (value === "current-date") out[key] = new Date().toLocaleDateString("en-US", { dateStyle: "full" });
      else if (value === "current-time") out[key] = new Date().toLocaleTimeString("en-US", { timeStyle: "medium" });
      else if (typeof value === "function") out[key] = await (value as (c: ActionContext) => unknown)(context);
      else out[key] = value;
    }
    return out;
  }
}
