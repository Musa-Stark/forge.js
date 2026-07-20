import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import sendOTP from "./utils/sendOTP.js";
import { hash } from "../utils/libsodium.js";
import appResponse from "../utils/response.js";
import getOTPUser from "./utils/getOTPUser.js";
import getUser from "./utils/getUser.js";
import getValidationKey from "../utils/validationKeyError.js";

const resendOTP = ({
  modelName,
  routeName,
  validationsObj,
  route,
}: {
  modelName: string;
  routeName: string;
  validationsObj: ValidationsObj;
  route: Route;
}) => {
  return async (req: Request, res: Response) => {
    // validationObj
    const validationObj = getValidationKey(route, validationsObj);

    // validate
    const body = validate(validationObj, req.body, route);

    // if body.purpose not found
    if (!req.body.purpose || !req.body.email)
      throw new AppError({
        message: "Email and purpose are required",
        statusCode: 409,
        code: "AUTH_CONFIGURATION_INVALID",
        hint: 'Provide email and purpose of resending OTP like "login", "signup" etc.',
        details: {
          handler: route.handler,
          method: route.method,
          path: route.path,
        },
      });

    // if user not found
    await getUser({
      modelName,
      routeName,
      email: body.email as string,
    });

    // get otpuser
    const OTPUser = await getOTPUser({
      email: body.email as string,
      purpose: body.purpose as string,
    });

    // if otp already verified
    if (OTPUser.isVerified) {
      appResponse({
        res,
        message: `${body.purpose}: OTP has already been verified.`,
        data: undefined,
      });
      return;
    }

    // sendOTP
    const { OTP, otpExpiry } = await sendOTP(body.email as string, route);
    const hashedOTP = await hash(OTP, route);

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
      data: {
        nextStep: "go to /verify-otp",
      },
      statusCode: 200,
    });
  };
};

export default resendOTP;
