import type { CommonEmailPlaceholders } from "../types/email/static-config.type.js";
import AppError from "../utils/AppError.js";
import AppLog from "../utils/AppLog.js";

// validate from:Email  -----------------------------------------------------------
export const validateFrom = (emailSender: string) => {
  if (!emailSender)
    throw new AppError({
      message: "systemEmailSender is required.",
      statusCode: 500,
      hint: "Define systemEmailSender in new StarkForge({}).",
      details: {
        handler: "",
        method: "",
        path: "",
      },
    });

  // regex
  const emailSenderRegex =
    /^\s*[^<>]+?\s*<\s*[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+\s*>\s*$/;

  // test
  const isValid = emailSenderRegex.test(emailSender);

  // if not valide
  if (!isValid)
    throw new AppError({
      details: {
        handler: "",
        method: "",
        path: "",
      },
      hint: 'Expected value: "Stark Forge <noreply@starkindustries.com>',
      message: "Invalid email sender, 'from'",
      statusCode: 409,
      code: "INVALID_EMAIL_SENDER",
    });

  return true;
};

// validate emailConfig ----------------------------------------------------------------------
export const emailConfig = (config: CommonEmailPlaceholders) => {
  if (!config) {
    AppLog(
      "warn",
      "emailConfig",
      `emailConfig was not provided in StarkForge({}). Email(s) may have undefined value(s).`,
    );
    return
  }

  const keys: (keyof CommonEmailPlaceholders)[] = [
    "companyName",
    "companyUrl",
    "companyAddress",
    "supportEmail",
    "unsubscribeUrl",
  ];

  for (const key of keys) {
    if (!config[key]) {
      AppLog(
        "warn",
        "emailConfig",
        `Missing email configuration: "${key}" was not provided in StarkForge({}). Email(s) may have undefined value(s).`,
      );
    }
  }
};
