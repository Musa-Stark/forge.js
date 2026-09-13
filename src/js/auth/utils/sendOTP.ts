import { randomInt } from "crypto";
import { getEnvs } from "../../config/envs.js";
import sendEmail from "../../config/sendEmail.js";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.js";
import { validateFrom } from "../../config/email.envs.js";
import { twoFactorCode } from "../../email/templates/index.js";
import { getCurrentYear } from "../../email/utils/auto-fields.js";

const sendOTP = async (
  email: string,
  routeObj: Route,
): Promise<{ OTP: string; otpExpiry: number }> => {
  const OTP = randomInt(100000, 1000000).toString();
  const otpExpiry = Date.now() + 1000 * 60 * 5;

  const { isOffline, systemEmailSender, builtinConfig } = getEnvs();
  const { email: emailConfig } = builtinConfig;

  if (!isOffline && isOffline !== false)
    throw new AppError({
      message: "isOffline is required.",
      statusCode: 500,
      hint: "Define isOffline in your environment configuration.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  if (isOffline) {
    console.log(`OTP: ${OTP}`);
    return { OTP, otpExpiry };
  }

  const htmlBody = twoFactorCode({
    otpCode: OTP,
    expiryMinutes: new Date(otpExpiry).getMinutes() - new Date().getMinutes(),
    currentYear: getCurrentYear(),
    userEmail: email,
    userName: "there",
    ...emailConfig!,
  });

  // validateFrom -------------------------------------------------------------------------
  validateFrom(systemEmailSender as string);

  await sendEmail({
    from: systemEmailSender as string,
    htmlBody,
    subject: "OTP Verification",
    to: email,
    routeObj,
  });

  return { OTP, otpExpiry };
};

export default sendOTP;
