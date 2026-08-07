import type { Response } from "express";
import AppError from "../../utils/AppError.js";
import sendOTP from "./sendOTP.js";
import appResponse from "../../utils/response.js";
import { hash } from "../../utils/libsodium.js";
import getOTPModel from "./getOTPModel.js";
import verifyCredentials from "./verifyCredentials.js";
import type { Route } from "../../types/Collection.js";
import getErrorDetail from "../../utils/getErrorDetail.js";

const createOTPUser = async ({
  body,
  res,
  purpose,
  routeName,
  modelName,
  routeObj,
}: {
  body: any;
  res: Response;
  purpose: string;
  routeName: string;
  modelName: string;
  routeObj: Route;
}) => {
  // otp model
  const OTPModel = getOTPModel(routeObj)!;

  // if no purpose
  if (!purpose)
    throw new AppError({
      message: "purpose is required.",
      statusCode: 400,
      hint: "Provide purpose before creating an OTP request.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  // if already requested otp
  const existingOTPs = await OTPModel.find({ email: body.email });

  for (const el of existingOTPs) {
    if (el.toObject().purpose === purpose)
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
      modelName,
      body,
      routeName,
      routeObj,
    });

  // send otp + handle hashing
  const { OTP, otpExpiry } = await sendOTP(body.email, routeObj);

  const hashedOTP = await hash(OTP, routeObj);

  if (body?.password) body.password = await hash(body.password, routeObj);

  // create otp
  await OTPModel.create({
    ...body,
    OTP: hashedOTP,
    otpExpiry,
    purpose,
  });

  // send response
  appResponse({
    res,
    message: "OTP sent successfully!",
    statusCode: 200,
    data: {
      nextStep: "go to /verify-otp",
    },
  });
};

export default createOTPUser;
