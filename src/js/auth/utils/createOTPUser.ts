import type { Response } from "express";
import registerModel from "../../lib/model.registry.js";
import AppError from "../../utils/AppError.js";
import sendOTP from "./sendOTP.js";
import appResponse from "../../utils/response.js";
import { hash, verifyHash } from "../../utils/libsodium.js";

const createOTPUser = async ({
  body,
  res,
  purpose,
  modelName,
}: {
  body: any;
  res: Response;
  purpose: string;
  modelName: string;
}) => {
  const OTPModel = registerModel["otpUser"];
  if (!OTPModel)
    throw new AppError({
      message: "OTP verification service is currently unavailable.",
      statusCode: 404,
    });

  if (!purpose)
    throw new AppError({
      message: "Purpose is required for OTP model",
      statusCode: 409,
    });

  // if already req otp
  const existing = await OTPModel?.findOne({ email: body.email });
  if (existing)
    throw new AppError({
      message: "You have already requested OTP",
      statusCode: 409,
    });

  // if login - check password - credentials mode
  if (purpose && purpose === "login") {
    const Model = registerModel[modelName];
    if (!Model)
      throw new AppError({
        message: `Model: ${modelName} not found to authenticate user`,
        statusCode: 404,
      });

    const user = await Model.findOne({ email: body.email }).select("+password");
    if (!user)
      throw new AppError({ message: "User not found.", statusCode: 404 });

    const isValid = await verifyHash(body.password, user.password);
    if (!isValid)
      throw new AppError({ message: "Invalid password", statusCode: 409 });
  }

  const { OTP, otpExpiry } = await sendOTP(body.email);
  const hashedOTP = await hash(OTP);
  body.password = await hash(body.password);

  await OTPModel?.create({
    ...body,
    OTP: hashedOTP,
    otpExpiry,
    purpose,
  });

  appResponse({
    res,
    message: "OTP sent successfully!",
    statusCode: 200,
  });
};

export default createOTPUser;
