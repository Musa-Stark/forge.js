import type { Response } from "express";
import AppError from "../../utils/AppError.js";
import sendOTP from "./sendOTP.js";
import appResponse from "../../utils/response.js";
import { hash } from "../../utils/libsodium.js";
import getOTPModel from "./getOTPModel.js";
import verifyCredentials from "./verifyCredentials.js";
import type { Route } from "../../types/Collection.js";

const createOTPUser = async ({
  body,
  res,
  purpose,
  routeName,
  modelName,
  route,
}: {
  body: any;
  res: Response;
  purpose: string;
  routeName: string;
  modelName: string;
  route: Route
}) => {
  // otp model
  const OTPModel = getOTPModel()!;

  // if not purpose
  if (!purpose)
    throw new AppError({
      message: "Purpose is required for OTP model",
      statusCode: 409,
    });

  // if already requested otp
  const existingOTPs = await OTPModel?.find({ email: body.email });
  for (const el of existingOTPs) {
    if (el.toObject().purpose === purpose)
      throw new AppError({
        message: "You have already requested an OTP",
        statusCode: 409,
        data: {
          nextStep: "check your email spam folder or request another OTP",
        },
      });
  }

  // if login - mode:otp
  if (purpose === "login")
    await verifyCredentials({ modelName, body, routeName, route });

  // send otp + handle hashing
  const { OTP, otpExpiry } = await sendOTP(body.email, route);
  const hashedOTP = await hash(OTP, route);
  if (body?.password) body.password = await hash(body.password, route);

  // create otp
  await OTPModel?.create({
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
