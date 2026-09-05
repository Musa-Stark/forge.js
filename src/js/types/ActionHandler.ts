import type { Request } from "express";
import type { Document, Model } from "mongoose";
import type { EmailTemplate } from "./email.js";
import type {
  AccountCreatedEmailPlaceholders,
  AccountDeletedEmailPlaceholders,
  AccountUpdatedEmailPlaceholders,
  AnnouncementEmailPlaceholders,
  ApiKeyCreatedEmailPlaceholders,
  ApiKeyRevokedEmailPlaceholders,
  ContactFormEmailPlaceholders,
  DailyReportEmailPlaceholders,
  EmailChangedEmailPlaceholders,
  FeedbackEmailPlaceholders,
  InvoiceEmailPlaceholders,
  LoginAlertEmailPlaceholders,
  MagicLinkEmailPlaceholders,
  MaintenanceEmailPlaceholders,
  MemberAddedEmailPlaceholders,
  MemberRemovedEmailPlaceholders,
  MentionEmailPlaceholders,
  MonthlyReportEmailPlaceholders,
  NewCommentEmailPlaceholders,
  NewDeviceLoginEmailPlaceholders,
  NewMessageEmailPlaceholders,
  NotificationEmailPlaceholders,
  OrderCancelledEmailPlaceholders,
  OrderConfirmationEmailPlaceholders,
  OrderDeliveredEmailPlaceholders,
  OrderShippedEmailPlaceholders,
  OrganizationInvitationEmailPlaceholders,
  PasswordChangedEmailPlaceholders,
  PasswordExpiringEmailPlaceholders,
  PasswordResetEmailPlaceholders,
  PaymentFailedEmailPlaceholders,
  PaymentSuccessEmailPlaceholders,
  ReceiptEmailPlaceholders,
  ReminderEmailPlaceholders,
  SecurityAlertEmailPlaceholders,
  SubscriptionCancelledEmailPlaceholders,
  SubscriptionCreatedEmailPlaceholders,
  SubscriptionRenewedEmailPlaceholders,
  SupportTicketEmailPlaceholders,
  TeamInvitationEmailPlaceholders,
  TrialEndingEmailPlaceholders,
  TwoFactorCodeEmailPlaceholders,
  VerifyEmailEmailPlaceholders,
  WeeklyReportEmailPlaceholders,
  WelcomeEmailPlaceholders,
} from "./email/index.js";

interface EmailActionTemplate {
  name: EmailTemplate;
  accountCreated?: AccountCreatedEmailPlaceholders;
  accountDeleted?: AccountDeletedEmailPlaceholders;
  accountUpdated?: AccountUpdatedEmailPlaceholders;
  announcement?: AnnouncementEmailPlaceholders;
  apiKeyCreated?: ApiKeyCreatedEmailPlaceholders;
  apiKeyRevoked?: ApiKeyRevokedEmailPlaceholders;
  contactForm?: ContactFormEmailPlaceholders;
  dailyReport?: DailyReportEmailPlaceholders;
  emailChanged?: EmailChangedEmailPlaceholders;
  feedback?: FeedbackEmailPlaceholders;
  invoice?: InvoiceEmailPlaceholders;
  loginAlert?: LoginAlertEmailPlaceholders;
  magicLink?: MagicLinkEmailPlaceholders;
  maintenance?: MaintenanceEmailPlaceholders;
  memberAdded?: MemberAddedEmailPlaceholders;
  memberRemoved?: MemberRemovedEmailPlaceholders;
  mention?: MentionEmailPlaceholders;
  monthlyReport?: MonthlyReportEmailPlaceholders;
  newComment?: NewCommentEmailPlaceholders;
  newDeviceLogin?: NewDeviceLoginEmailPlaceholders;
  newMessage?: NewMessageEmailPlaceholders;
  notification?: NotificationEmailPlaceholders;
  orderCancelled?: OrderCancelledEmailPlaceholders;
  orderConfirmation?: OrderConfirmationEmailPlaceholders;
  orderDelivered?: OrderDeliveredEmailPlaceholders;
  orderShipped?: OrderShippedEmailPlaceholders;
  organizationInvitation?: OrganizationInvitationEmailPlaceholders;
  passwordChanged?: PasswordChangedEmailPlaceholders;
  passwordExpiring?: PasswordExpiringEmailPlaceholders;
  passwordReset?: PasswordResetEmailPlaceholders;
  paymentFailed?: PaymentFailedEmailPlaceholders;
  paymentSuccess?: PaymentSuccessEmailPlaceholders;
  receipt?: ReceiptEmailPlaceholders;
  reminder?: ReminderEmailPlaceholders;
  securityAlert?: SecurityAlertEmailPlaceholders;
  subscriptionCancelled?: SubscriptionCancelledEmailPlaceholders;
  subscriptionCreated?: SubscriptionCreatedEmailPlaceholders;
  subscriptionRenewed?: SubscriptionRenewedEmailPlaceholders;
  supportTicket?: SupportTicketEmailPlaceholders;
  teamInvitation?: TeamInvitationEmailPlaceholders;
  trialEnding?: TrialEndingEmailPlaceholders;
  twoFactorCode?: TwoFactorCodeEmailPlaceholders;
  verifyEmail?: VerifyEmailEmailPlaceholders;
  weeklyReport?: WeeklyReportEmailPlaceholders;
  welcome?: WelcomeEmailPlaceholders;
}

/**
 * Context provided to Forge actions before or after a route operation.
 */
export interface ActionContext {
  /** Express request object. */
  req: Request;

  /** Authenticated user attached to the request, if available. */
  user?: Request["user"];

  /**
   * Name of the Forge resource/route.
   *
   * @example "products"
   */
  route: string;

  /**
   * Database operation being performed.
   */
  operation:
    | "read"
    | "readAll"
    | "create"
    | "update"
    | "remove"
    | "removeMultiple"
    | "removeAll";

  /**
   * Mongoose model name.
   *
   * @example "Product"
   */
  model: string;

  /** Mongoose model for direct database access. */
  Model?: Model<any>;

  /**
   * Data associated with the current request and operation.
   */
  data?: {
    /** ID of the resource owner. */
    owner?: string;

    /** Parsed request body. */
    body?: any;

    /** Uploaded file metadata. */
    files?: any;

    /** Values encrypted by Forge. */
    encrypted?: any;

    /** Values decrypted by Forge. */
    decrypted?: any;

    /** Values hashed by Forge. */
    hashed?: any;
  };

  /**
   * Document(s) affected by the operation.
   */
  item?: Document | Document[];

  /**
   * Current result produced by the operation/action chain.
   *
   * Return a value from a custom action to replace this result.
   */
  result?: any;
}

/**
 * Executes custom developer-defined logic.
 *
 * Returning a value replaces the current action result.
 */
export interface CustomAction {
  /** Custom action handler. */
  customAction: (context: ActionContext) => Promise<any> | any;
}

/**
 * Sends an email through Forge's configured email provider.
 */
export interface EmailAction {
  /** Email action configuration. */

  emailAction: {
    /** Sender configuration. */
    from: "system-email-sender" | ({} & string);

    /** Recipient email address. */
    to: string | ((context: ActionContext) => string);

    /** Email content mode. */
    type: "template" | "raw";

    /** Raw email body when `type` is `raw`. */
    rawBody?: string;

    /** Email template when `type` is `template`. */
    template?: EmailActionTemplate;

    /** Email subject. */
    subject?: string | ((context: ActionContext) => string);
  };
}

/**
 * Action executed before or after a Forge route operation.
 */
export type Action = CustomAction | EmailAction;

/**
 * @deprecated Use `ActionContext` instead.
 */
export type CreateContext = ActionContext;
