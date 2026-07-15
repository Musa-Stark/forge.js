import { randomInt } from "crypto";
import { getEnvs } from "../../config/envs.js";
import sendEmail from "../../config/sendEmail.js";
import AppError from "../../utils/AppError.js";

const sendOTP = async (
  email: string,
): Promise<{ OTP: string; otpExpiry: number }> => {
  const OTP = randomInt(100000, 1000000).toString();
  const otpExpiry = Date.now() + 1000 * 60 * 5;

  const { isOffline, adminEmailSender } = getEnvs();
  if (!isOffline && isOffline !== false)
    throw new AppError({ message: "isOffline is required", statusCode: 404 });

  if (isOffline) {
    console.log(`OTP: ${OTP}`);
    return { OTP, otpExpiry };
  }

  const htmlBody = `<!doctype html><html><head><meta charset="UTF-8"><title>Core Computing Society - Email Verification</title></head><body style="margin:0;padding:0;font-family:Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:40px 0;padding-top:0"><tr><td align="center"><table width="500" cellpadding="0" cellspacing="0" border="0" style="border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,.08);padding:40px;padding-top:10px"><tr><td align="center" style="padding-bottom:20px"><h2 style="margin:0;color:#111827;font-weight:600">Core Computing Society</h2></td></tr><tr><td align="center" style="padding-bottom:20px"><h1 style="margin:0;font-size:22px;color:#111827">Verify Your Email Address</h1></td></tr><tr><td align="center" style="padding-bottom:30px;color:#6b7280;font-size:15px;line-height:1.6">Welcome to the <strong>Core Computing Society (CCS)</strong>. Use the verification code below to verify your email address. This code will expire in <strong>5 minutes</strong>.</td></tr><tr><td align="center" style="padding-bottom:30px"><div style="display:inline-block;padding:18px 32px;font-size:28px;letter-spacing:8px;font-weight:bold;color:#111827;background:#f3f4f6;border-radius:8px;border:1px solid #e5e7eb">${OTP}</div></td></tr><tr><td align="center" style="color:#9ca3af;font-size:13px;line-height:1.5">If you didn't request this verification code, you can safely ignore this email. Never share your verification code with anyone.</td></tr><tr><td style="padding-top:30px"><hr style="border:none;border-top:1px solid #e5e7eb"></td></tr><tr><td align="center" style="padding-top:15px;font-size:12px;color:#9ca3af">© 2026 Core Computing Society. All rights reserved.</td></tr></table></td></tr></table></body></html>`;

  if (!adminEmailSender)
    throw new AppError({
      message: "adminEmailSender is required",
      statusCode: 404,
    });

  await sendEmail({
    from: adminEmailSender,
    htmlBody,
    subject: "OTP Verification",
    to: email,
  });

  return { OTP, otpExpiry };
};

export default sendOTP;
