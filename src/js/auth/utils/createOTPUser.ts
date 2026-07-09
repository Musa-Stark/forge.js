import type { Response } from "express";
import registerModel from "../../lib/model.registry.js";
import AppError from "../../utils/AppError.js";
import sendOTP from "./sendOTP.js";
import appResponse from "../../utils/response.js";
import { hash } from "../../utils/libsodium.js";

const createOTPUser = async ({
  body,
  res,
  purpose,
}: {
  body: any;
  res: Response;
  purpose: string;
}) => {
  const Model = registerModel["otpUser"];
  if (!Model)
    throw new AppError({
      message: "OTP verification service is currently unavailable.",
      statusCode: 404,
    });

  if (!purpose)
    throw new AppError({
      message: "Purpose is required for OTP Model",
      statusCode: 409,
    });

  const existing = await Model?.findOne({ email: body.email });
  if (existing)
    throw new AppError({
      message: "You have already requested OTP",
      statusCode: 409,
    });

  const { OTP, otpExpiry } = await sendOTP(body.email);
  const hashedOTP = await hash(OTP);
  body.password = await hash(body.password);

  await Model?.create({
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
