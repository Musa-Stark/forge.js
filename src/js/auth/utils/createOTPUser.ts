import type { Response } from "express";
import registerModel from "../../lib/model.registry.js";
import AppError from "../../utils/AppError.js";
import sendOTP from "./sendOTP.js";
import appResponse from "../../utils/response.js";

const createOTPUser = async ({ body, res }: { body: any; res: Response }) => {
  const Model = registerModel["otpUser"];
  if (!Model)
    throw new AppError({
      message: "OTP Users Model not found",
      statusCode: 404,
    });

  const existing = await Model?.findOne({ email: body.email });
  if (existing)
    throw new AppError({
      message: "You have already requested OTP",
      statusCode: 409,
    });

  const { OTP, otpExpiry } = await sendOTP(body.email);

  await Model?.create({ ...body, OTP, otpExpiry });

  appResponse({
    res,
    message: "OTP sent successfully!",
    statusCode: 301,
  });
};

export default createOTPUser;
