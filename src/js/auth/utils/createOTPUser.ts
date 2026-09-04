import type { Response } from "express";
import AppError from "../../utils/AppError.js";
import sendOTP from "./sendOTP.js";
import appResponse from "../../utils/response.js";
import { hash } from "../../utils/libsodium.js";
import getOTPModel from "./getOTPModel.js";
import verifyCredentials from "./verifyCredentials.js";
import type { Route } from "../../types/Collection.js";
import getErrorDetail from "../../utils/getErrorDetail.js";
import { getEnvs } from "../../config/envs.js";

const createOTPUser = async ({
  body,
  res,
  purpose,
  route,
  model,
  routeObj,
}: {
  body: any;
  res: Response;
  purpose: string;
  route: string;
  model: string;
  routeObj: Route;
}) => {
  // get dynamic auth field keys
  const { authConfigObj } = getEnvs();
  const { fieldsObj } = authConfigObj;

  const emailKey = fieldsObj?.email;
  const passwordKey = fieldsObj?.password;
  const otpKey = fieldsObj?.otp;
  const purposeKey = fieldsObj?.purpose;

  // otp model
  const OTPModel = getOTPModel(routeObj)!;

  // if no purpose
  if (!purpose)
    throw new AppError({
      message: `${purposeKey} is required.`,
      statusCode: 400,
      hint: `Provide ${purposeKey} before creating an OTP request.`,
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  // if already requested otp
  const existingOTPs = await OTPModel.find({
    [emailKey!]: body[emailKey!],
  });

  for (const el of existingOTPs) {
    if (el.toObject()[purposeKey!] === purpose)
      throw new AppError({
        message: "OTP has already been requested.",
        statusCode: 409,
        hint: "Check your email, including the spam folder, or request another OTP after the current one expires.",
        details: getErrorDetail(routeObj),
      });
  }

  // if login - mode: otp
  if (purpose === "login")
    await verifyCredentials({
      model,
      body,
      route,
      routeObj,
    });

  // send otp + handle hashing
  const { OTP, otpExpiry } = await sendOTP(
    body[emailKey!],
    routeObj
  );

  const hashedOTP = await hash(OTP, routeObj);

  if (body?.[passwordKey!])
    body[passwordKey!] = await hash(body[passwordKey!], routeObj);

  // create otp
  await OTPModel.create({
    ...body,
    [otpKey!]: hashedOTP,
    otpExpiry,
    [purposeKey!]: purpose,
  });

  // send response
  appResponse({
    res,
    message: "OTP sent successfully!",
    statusCode: 200,
    data: {
      nextStep: `go to /verify-otp with ${purposeKey}: ${purpose}`,
    },
  });
};

export default createOTPUser;