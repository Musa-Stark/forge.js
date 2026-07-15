import { Resend } from "resend";

import { getEnvs } from "./envs.js";
import AppError from "../utils/AppError.js";

export interface Email {
  from: string;
  subject: string;
  htmlBody: string;
  to: string | string[];
}

const sendEmail = async ({
  from,
  subject,
  htmlBody,
  to,
}: Email): Promise<boolean> => {
  if (!from)
    throw new AppError({
      message: "Email sender is required",
      statusCode: 404,
    });

  if (!to) {
    throw new AppError({
      message: "Email receiver is required",
      statusCode: 404,
    });
  }

  if (!subject) {
    throw new AppError({
      message: "Email subject is required",
      statusCode: 404,
    });
  }

  if (!htmlBody) {
    throw new AppError({ message: "Email body is required", statusCode: 404 });
  }

  // email didin't sent, mongoose timeout error

  const { resendAPIKey } = getEnvs();
  if (!resendAPIKey) {
    throw new AppError({
      message: "resendAPIKey is required",
      statusCode: 404,
    });
  }

  const resend = new Resend(resendAPIKey);

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html: htmlBody,
  });

  if (error) {
    console.log("Email error: ")
    console.dir(error, { depth: null });
    throw new AppError({ message: error.message, statusCode: 409 });
  }

  return true;
};

export default sendEmail;
