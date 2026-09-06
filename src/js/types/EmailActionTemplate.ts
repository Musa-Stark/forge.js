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

export type ExcludedEmailFields =
  | "currentYear"
  | "companyName"
  | "companyUrl"
  | "companyAddress"
  | "supportEmail"
  | "unsubscribeUrl";

export interface EmailActionTemplate {
  name: EmailTemplate;
  accountCreated?: Omit<AccountCreatedEmailPlaceholders, ExcludedEmailFields>;
  accountDeleted?: Omit<AccountDeletedEmailPlaceholders, ExcludedEmailFields>;
  accountUpdated?: Omit<AccountUpdatedEmailPlaceholders, ExcludedEmailFields>;
  announcement?: Omit<AnnouncementEmailPlaceholders, ExcludedEmailFields>;
  apiKeyCreated?: Omit<ApiKeyCreatedEmailPlaceholders, ExcludedEmailFields>;
  apiKeyRevoked?: Omit<ApiKeyRevokedEmailPlaceholders, ExcludedEmailFields>;
  contactForm?: Omit<ContactFormEmailPlaceholders, ExcludedEmailFields>;
  dailyReport?: Omit<DailyReportEmailPlaceholders, ExcludedEmailFields>;
  emailChanged?: Omit<EmailChangedEmailPlaceholders, ExcludedEmailFields>;
  feedback?: Omit<FeedbackEmailPlaceholders, ExcludedEmailFields>;
  invoice?: Omit<InvoiceEmailPlaceholders, ExcludedEmailFields>;
  loginAlert?: Omit<LoginAlertEmailPlaceholders, ExcludedEmailFields>;
  magicLink?: Omit<MagicLinkEmailPlaceholders, ExcludedEmailFields>;
  maintenance?: Omit<MaintenanceEmailPlaceholders, ExcludedEmailFields>;
  memberAdded?: Omit<MemberAddedEmailPlaceholders, ExcludedEmailFields>;
  memberRemoved?: Omit<MemberRemovedEmailPlaceholders, ExcludedEmailFields>;
  mention?: Omit<MentionEmailPlaceholders, ExcludedEmailFields>;
  monthlyReport?: Omit<MonthlyReportEmailPlaceholders, ExcludedEmailFields>;
  newComment?: Omit<NewCommentEmailPlaceholders, ExcludedEmailFields>;
  newDeviceLogin?: Omit<NewDeviceLoginEmailPlaceholders, ExcludedEmailFields>;
  newMessage?: Omit<NewMessageEmailPlaceholders, ExcludedEmailFields>;
  notification?: Omit<NotificationEmailPlaceholders, ExcludedEmailFields>;
  orderCancelled?: Omit<OrderCancelledEmailPlaceholders, ExcludedEmailFields>;
  orderConfirmation?: Omit<
    OrderConfirmationEmailPlaceholders,
    ExcludedEmailFields
  >;
  orderDelivered?: Omit<OrderDeliveredEmailPlaceholders, ExcludedEmailFields>;
  orderShipped?: Omit<OrderShippedEmailPlaceholders, ExcludedEmailFields>;
  organizationInvitation?: Omit<
    OrganizationInvitationEmailPlaceholders,
    ExcludedEmailFields
  >;
  passwordChanged?: Omit<PasswordChangedEmailPlaceholders, ExcludedEmailFields>;
  passwordExpiring?: Omit<
    PasswordExpiringEmailPlaceholders,
    ExcludedEmailFields
  >;
  passwordReset?: Omit<PasswordResetEmailPlaceholders, ExcludedEmailFields>;
  paymentFailed?: Omit<PaymentFailedEmailPlaceholders, ExcludedEmailFields>;
  paymentSuccess?: Omit<PaymentSuccessEmailPlaceholders, ExcludedEmailFields>;
  receipt?: Omit<ReceiptEmailPlaceholders, ExcludedEmailFields>;
  reminder?: Omit<ReminderEmailPlaceholders, ExcludedEmailFields>;
  securityAlert?: Omit<SecurityAlertEmailPlaceholders, ExcludedEmailFields>;
  subscriptionCancelled?: Omit<
    SubscriptionCancelledEmailPlaceholders,
    ExcludedEmailFields
  >;
  subscriptionCreated?: Omit<
    SubscriptionCreatedEmailPlaceholders,
    ExcludedEmailFields
  >;
  subscriptionRenewed?: Omit<
    SubscriptionRenewedEmailPlaceholders,
    ExcludedEmailFields
  >;
  supportTicket?: Omit<SupportTicketEmailPlaceholders, ExcludedEmailFields>;
  teamInvitation?: Omit<TeamInvitationEmailPlaceholders, ExcludedEmailFields>;
  trialEnding?: Omit<TrialEndingEmailPlaceholders, ExcludedEmailFields>;
  twoFactorCode?: Omit<TwoFactorCodeEmailPlaceholders, ExcludedEmailFields>;
  verifyEmail?: Omit<VerifyEmailEmailPlaceholders, ExcludedEmailFields>;
  weeklyReport?: Omit<WeeklyReportEmailPlaceholders, ExcludedEmailFields>;
  welcome?: Omit<WelcomeEmailPlaceholders, ExcludedEmailFields>;
}
