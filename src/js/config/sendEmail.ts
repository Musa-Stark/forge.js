import { Resend } from "resend";

import { getEnvs } from "./envs.js";
import AppError from "../utils/AppError.js";
import type { Route } from "../types/Collection.js";

export interface Email {
  from: string;
  subject: string;
  htmlBody: string;
  to: string | string[];
  routeObj: Route;
}

const sendEmail = async ({
  from,
  subject,
  htmlBody,
  to,
  routeObj,
}: Email): Promise<boolean> => {
  if (!from)
    throw new AppError({
      message: "Email sender is required",
      statusCode: 404,
      hint: "This issue requires a fix from the framework developer.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  if (!to) {
    throw new AppError({
      message: "Email receiver is required",
      statusCode: 404,
      hint: "This issue requires a fix from the framework developer.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });
  }

  if (!subject) {
    throw new AppError({
      message: "Email subject is required",
      statusCode: 404,
      hint: "This issue requires a fix from the framework developer.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });
  }

  if (!htmlBody) {
    throw new AppError({
      message: "Email body is required",
      statusCode: 404,
      hint: "This issue requires a fix from the framework developer.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });
  }

  // email didin't sent, mongoose timeout error

  const { resendAPIKey } = getEnvs();
  if (!resendAPIKey) {
    throw new AppError({
      message: "resendAPIKey is required",
      statusCode: 404,
      hint: "This issue requires a fix from the framework developer.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
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
    console.log("Email error: ");
    console.dir(error, { depth: null });
    throw new AppError({
      message: error.message,
      statusCode: 409,
      hint: "This issue requires a fix from the framework developer.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });
  }

  console.log("Email sent successfully!")

  return true;
};

export default sendEmail;
