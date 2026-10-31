import { ErrorCode, InternalError } from "../errors/index.js";
import type { EmailTemplate } from "../types/email.js";
import { escapeHtml, safeUrl } from "../utils/html.js";
import * as templates from "./templates/index.js";

type TemplateFn = (placeholders: any) => string | Promise<string>;

/** kebab-case name -> template function. */
const REGISTRY: Record<EmailTemplate, TemplateFn> = {
  welcome: templates.welcome,
  "verify-email": templates.verifyEmail,
  "password-reset": templates.passwordReset,
  "password-changed": templates.passwordChanged,
  "login-alert": templates.loginAlert,
  "two-factor-code": templates.twoFactorCode,
  "magic-link": templates.magicLink,
  "account-created": templates.accountCreated,
  "account-updated": templates.accountUpdated,
  "account-deleted": templates.accountDeleted,
  "email-changed": templates.emailChanged,
  "team-invitation": templates.teamInvitation,
  "organization-invitation": templates.organizationInvitation,
  "member-added": templates.memberAdded,
  "member-removed": templates.memberRemoved,
  "new-message": templates.newMessage,
  "new-comment": templates.newComment,
  mention: templates.mention,
  notification: templates.notification,
  reminder: templates.reminder,
  invoice: templates.invoice,
  receipt: templates.receipt,
  "payment-success": templates.paymentSuccess,
  "payment-failed": templates.paymentFailed,
  "subscription-created": templates.subscriptionCreated,
  "subscription-renewed": templates.subscriptionRenewed,
  "subscription-cancelled": templates.subscriptionCancelled,
  "trial-ending": templates.trialEnding,
  "order-confirmation": templates.orderConfirmation,
  "order-shipped": templates.orderShipped,
  "order-delivered": templates.orderDelivered,
  "order-cancelled": templates.orderCancelled,
  "password-expiring": templates.passwordExpiring,
  "security-alert": templates.securityAlert,
  "new-device-login": templates.newDeviceLogin,
  "api-key-created": templates.apiKeyCreated,
  "api-key-revoked": templates.apiKeyRevoked,
  "contact-form": templates.contactForm,
  "support-ticket": templates.supportTicket,
  feedback: templates.feedback,
  "daily-report": templates.dailyReport,
  "weekly-report": templates.weeklyReport,
  "monthly-report": templates.monthlyReport,
  maintenance: templates.maintenance,
  announcement: templates.announcement,
};

const URL_KEY = /(url|link)$/i;

/** `"two-factor-code"` -> `"twoFactorCode"`: the key that holds a template's placeholders. */
export const templateConfigKey = (name: string): string =>
  name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/**
 * Renders the 45 built-in templates.
 *
 * Every placeholder value is HTML-escaped (and link placeholders restricted to
 * http/https/mailto) *before* it reaches the template, so user-controlled data
 * such as a display name can never inject markup into an e-mail.
 */
export class TemplateRenderer {
  has(name: string): name is EmailTemplate {
    return Object.hasOwn(REGISTRY, name);
  }

  names(): EmailTemplate[] {
    return Object.keys(REGISTRY) as EmailTemplate[];
  }

  async render(name: string, placeholders: Record<string, unknown>): Promise<string> {
    if (!this.has(name)) {
      throw new InternalError({
        message: `Unknown e-mail template '${name}'.`,
        code: ErrorCode.EMAIL_TEMPLATE_ERROR,
        hint: `Available templates: ${this.names().join(", ")}.`,
        isOperational: false,
      });
    }
    try {
      return await REGISTRY[name](this.escape(placeholders));
    } catch (cause) {
      throw new InternalError({
        message: `Failed to render the '${name}' e-mail template.`,
        code: ErrorCode.EMAIL_TEMPLATE_ERROR,
        hint: "Check that every required placeholder of the template was provided.",
        cause,
      });
    }
  }

  private escape(value: Record<string, unknown>, key = ""): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = this.escapeValue(v, k || key);
    return out;
  }

  private escapeValue(value: unknown, key: string): unknown {
    if (typeof value === "string") return URL_KEY.test(key) ? escapeHtml(safeUrl(value)) : escapeHtml(value);
    if (Array.isArray(value)) return value.map((item) => this.escapeValue(item, key));
    if (value && typeof value === "object") return this.escape(value as Record<string, unknown>, key);
    return value;
  }
}
