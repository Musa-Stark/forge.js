import type { ActionContext } from "../types/ActionHandler.js";
import AppError from "../utils/AppError.js";
import { getEnvs } from "../config/envs.js";
import sendEmail from "../config/sendEmail.js";
import { welcomeEmail } from "./templates/index.js";

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
      // switch (template.name) {
      //   case "welcome":
      //     console.log(template);
      //     body = welcomeEmail(template.placeholders);
      //     break;

      //   default:
      //     throw new AppError({
      //       message: `Unsupported email template: ${template}`,
      //       statusCode: 400,
      //       code: "UNSUPPORTED_EMAIL_TEMPLATE",
      //       details,
      //       hint: "Use one of the email templates supported by Forge.",
      //     });
      // }
      console.log(template)
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
    // await sendEmail({
    //   from: sender,
    //   to: recipient,
    //   subject: resolvedSubject,
    //   htmlBody: body,
    //   routeObj: {
    //     auth: "authenticated",
    //     handler: "readAll",
    //     method: "get",
    //     path: "/",
    //   },
    // });
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
