export type EmailType = "template" | "custom" | "rawHTML";

export type EmailTemplate =
  | "welcome"
  | "verify-email"
  | "password-reset"
  | "password-changed"
  | "login-alert"
  | "two-factor-code"
  | "magic-link"
  //
  | "account-created"
  | "account-updated"
  | "account-deleted"
  | "email-changed"
  //
  | "team-invitation"
  | "organization-invitation"
  | "member-added"
  | "member-removed"
  //
  | "new-message"
  | "new-comment"
  | "mention"
  | "notification"
  | "reminder"
  //
  | "invoice"
  | "receipt"
  | "payment-success"
  | "payment-failed"
  | "subscription-created"
  | "subscription-renewed"
  | "subscription-cancelled"
  | "trial-ending"
  //
  | "order-confirmation"
  | "order-shipped"
  | "order-delivered"
  | "order-cancelled"
  //
  | "password-expiring"
  | "security-alert"
  | "new-device-login"
  | "api-key-created"
  | "api-key-revoked"
  //
  | "contact-form"
  | "support-ticket"
  | "feedback"
  //
  | "daily-report"
  | "weekly-report"
  | "monthly-report"
  //
  | "maintenance"
  | "announcement";

export type EmailProvider = "resend";

export interface Email {
  type: EmailType;
  provider: EmailProvider;
  to: string;
  template?: EmailTemplate;
  subject?: string;
  body?: string;
}