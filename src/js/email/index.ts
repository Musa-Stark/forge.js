import type { ActionContext } from "../types/ActionHandler.js";
import AppError from "../utils/AppError.js";
import { getEnvs } from "../config/envs.js";
import sendEmail from "../config/sendEmail.js";
import type { EmailTemplate } from "../types/email.js";
import {
  accountCreated,
  accountDeleted,
  accountUpdated,
  announcement,
  apiKeyCreated,
  apiKeyRevoked,
  contactForm,
  dailyReport,
  emailChanged,
  feedback,
  invoice,
  loginAlert,
  magicLink,
  maintenance,
  memberAdded,
  memberRemoved,
  mention,
  monthlyReport,
  newComment,
  newDeviceLogin,
  newMessage,
  notification,
  orderCancelled,
  orderConfirmation,
  orderDelivered,
  orderShipped,
  organizationInvitation,
  passwordChanged,
  passwordExpiring,
  passwordReset,
  paymentFailed,
  paymentSuccess,
  receipt,
  reminder,
  securityAlert,
  subscriptionCancelled,
  subscriptionCreated,
  subscriptionRenewed,
  supportTicket,
  teamInvitation,
  trialEnding,
  twoFactorCode,
  verifyEmail,
  weeklyReport,
  welcome,
} from "./templates/index.js";

export const emailTemplates: Record<string, any> = {
  welcome: welcome,
  "verify-email": verifyEmail,
  "password-reset": passwordReset,
  "password-changed": passwordChanged,
  "login-alert": loginAlert,
  "two-factor-code": twoFactorCode,
  "magic-link": magicLink,

  "account-created": accountCreated,
  "account-updated": accountUpdated,
  "account-deleted": accountDeleted,
  "email-changed": emailChanged,

  "team-invitation": teamInvitation,
  "organization-invitation": organizationInvitation,
  "member-added": memberAdded,
  "member-removed": memberRemoved,

  "new-message": newMessage,
  "new-comment": newComment,
  mention: mention,
  notification: notification,
  reminder: reminder,

  invoice: invoice,
  receipt: receipt,
  "payment-success": paymentSuccess,
  "payment-failed": paymentFailed,
  "subscription-created": subscriptionCreated,
  "subscription-renewed": subscriptionRenewed,
  "subscription-cancelled": subscriptionCancelled,
  "trial-ending": trialEnding,

  "order-confirmation": orderConfirmation,
  "order-shipped": orderShipped,
  "order-delivered": orderDelivered,
  "order-cancelled": orderCancelled,

  "password-expiring": passwordExpiring,
  "security-alert": securityAlert,
  "new-device-login": newDeviceLogin,
  "api-key-created": apiKeyCreated,
  "api-key-revoked": apiKeyRevoked,

  "contact-form": contactForm,
  "support-ticket": supportTicket,
  feedback: feedback,

  "daily-report": dailyReport,
  "weekly-report": weeklyReport,
  "monthly-report": monthlyReport,

  maintenance: maintenance,
  announcement: announcement,
} satisfies Record<EmailTemplate, unknown>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_SENDER_REGEX = /^[^<>]+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/;

const emailAction = async (
  item: any,
  context: ActionContext,
): Promise<void> => {
  const { from, to, type, rawBody, template, subject } = item;

  const details = {
    handler: "emailAction",
    method: context.req.method,
    path: context.req.path,
  };

  // --------------------------------------------------
  // Required configuration
  // --------------------------------------------------

  if (!from || !to || !type) {
    throw new AppError({
      message: "from, to and type are required to send an email.",
      statusCode: 400,
      code: "EMAIL_ACTION_CONFIG_ERROR",
      details,
      hint: "Provide from, to and type in the emailAction configuration.",
    });
  }

  // --------------------------------------------------
  // Sender
  // --------------------------------------------------

  const sender =
    from === "system-email-sender" ? getEnvs().systemEmailSender : from;

  if (!sender || !EMAIL_SENDER_REGEX.test(sender)) {
    throw new AppError({
      message: "Invalid email sender.",
      statusCode: 400,
      code: "INVALID_EMAIL_SENDER",
      details,
      hint: "Expected value: e.g, 'Starklabs <noreply@starklabs.com>'",
    });
  }

  // --------------------------------------------------
  // Recipient
  // --------------------------------------------------

  let recipient: string;

  try {
    recipient = typeof to === "function" ? to(context) : to;
  } catch (error) {
    throw new AppError({
      message: "Failed to resolve the email recipient.",
      statusCode: 400,
      code: "EMAIL_RECIPIENT_RESOLUTION_ERROR",
      details,
      hint: "Check the function provided to the to field.",
    });
  }

  if (!recipient || !EMAIL_REGEX.test(recipient)) {
    throw new AppError({
      message: "'to' must be a valid email address.",
      statusCode: 400,
      code: "INVALID_EMAIL_RECIPIENT",
      details,
      hint: "Provide a valid email address or a function that returns one.",
    });
  }

  // --------------------------------------------------
  // Subject
  // --------------------------------------------------

  let resolvedSubject: string | undefined;

  try {
    resolvedSubject =
      typeof subject === "function" ? subject(context) : subject;
  } catch (error) {
    throw new AppError({
      message: "Failed to resolve the email subject.",
      statusCode: 400,
      code: "EMAIL_SUBJECT_RESOLUTION_ERROR",
      details,
      hint: "Check the function provided to the subject field.",
    });
  }

  if (!resolvedSubject) {
    throw new AppError({
      message: "subject is required to send an email.",
      statusCode: 400,
      code: "EMAIL_SUBJECT_REQUIRED",
      details,
      hint: "Provide a subject or a function that returns one.",
    });
  }

  // --------------------------------------------------
  // Email body
  // --------------------------------------------------

  let body: string;

  if (type === "template") {
    if (!template) {
      throw new AppError({
        message: "template is required when email type is 'template'.",
        statusCode: 400,
        code: "EMAIL_TEMPLATE_REQUIRED",
        details,
        hint: "Provide a supported email template.",
      });
    }

    try {
      const funcName = emailTemplates[template.name].name.replace("Email", "");
      body = emailTemplates[template.name](template[funcName])
    } catch (error) {
      // Don't destroy an AppError produced by the template handler.
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError({
        message: "Failed to generate the email from the template.",
        statusCode: 500,
        code: "EMAIL_TEMPLATE_ERROR",
        isOperational: false,
        details,
        hint: "Check the selected template and its required data.",
      });
    }
  } else {
    if (!rawBody) {
      throw new AppError({
        message: "rawBody is required when email type is 'raw'.",
        statusCode: 400,
        code: "EMAIL_RAW_BODY_REQUIRED",
        details,
        hint: "Provide rawBody when using type 'raw'.",
      });
    }

    body = rawBody;
  }

  // --------------------------------------------------
  // Send email
  // --------------------------------------------------

  try {
    await sendEmail({
      from: sender,
      to: recipient,
      subject: resolvedSubject,
      htmlBody: body,
      routeObj: {
        auth: "authenticated",
        handler: "readAll",
        method: "get",
        path: "/",
      },
    });
  } catch (error) {
    throw new AppError({
      message: "Failed to send email.",
      statusCode: 500,
      code: "EMAIL_SEND_ERROR",
      isOperational: false,
      details,
      hint: "Check the configured email provider and its credentials.",
    });
  }
};

export default emailAction;
