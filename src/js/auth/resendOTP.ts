import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import sendOTP from "./utils/sendOTP.js";
import registerModel from "../lib/model.registry.js";
import { hash } from "../utils/libsodium.js";
import appResponse from "../utils/response.js";

const resendOTP = ({
  modelName,
  route,
  validationsObj,
}: {
  modelName: string;
  route: Route;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response) => {
    if (!modelName)
      throw new AppError({
        message: `modelName for ${route} route is required`,
        statusCode: 404,
      });

    // validate
    const body = validate(validationsObj.resendOTP, req.body);
    const Model = registerModel[modelName]!;

    // if user not found
    const user = await Model.findOne({ email: body.email });
    if (!user)
      throw new AppError({ message: "User not found.", statusCode: 404 });

    // if otp model not found
    const OTPModel = registerModel["otpUser"];
    if (!OTPModel)
      throw new AppError({
        message: "OTP verification service is currently unavailable.",
        statusCode: 409,
      });

    // if otp user not found
    const OTPUser = await OTPModel.findOne({ email: body.email });
    if (!OTPUser)
      throw new AppError({
        message: "No OTP request was found for the provided email address.",
        statusCode: 404,
      });

    // sendOTP
    const { OTP, otpExpiry } = await sendOTP(body.email as string);
    const hashedOTP = await hash(OTP);

    OTPUser.otpCount = 0;
    OTPUser.OTP = hashedOTP;
    OTPUser.otpExpiry = otpExpiry;
    OTPUser.isVerified = false;

    // save updated otp
    OTPUser.save();

    // send response
    appResponse({
      res,
      message: "OTP resent successfully!",
      statusCode: 200,
    });
  };
};

export default resendOTP;
