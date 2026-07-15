import type { Response } from "express";
import appResponse from "../../utils/response.js";
import AppError from "../../utils/AppError.js";

const otpVerifiedResponse = ({ res, body }: { res: Response; body: any }) => {
  if (!body.purpose)
    throw new AppError({
      message: "purpose is required for otp verified response",
      statusCode: 409,
    });

  appResponse({ res, message: `${body.purpose}: otp verified successfully!` });
};

export default otpVerifiedResponse;
