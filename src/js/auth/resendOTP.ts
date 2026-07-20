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
        message: "email and purpose are required.",
        statusCode: 400,
        code: "VALIDATION_REQUIRED_FIELD_MISSING",
        hint: 'Provide email and purpose (e.g. "login", "signup", "password_reset") in the request body.',
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
      route
    });

    // get otp user
    const OTPUser = await getOTPUser({
      email: body.email as string,
      purpose: body.purpose as string,
      route,
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

    // send OTP
    const { OTP, otpExpiry } = await sendOTP(body.email as string, route);
    const hashedOTP = await hash(OTP, route);

    OTPUser.otpCount = 0;
    OTPUser.OTP = hashedOTP;
    OTPUser.otpExpiry = otpExpiry;
    OTPUser.isVerified = false;

    // save updated otp
    await OTPUser.save();

    // send response
    appResponse({
      res,
      message: "OTP resent successfully!",
      statusCode: 200,
      data: {
        nextStep: "go to /verify-otp",
      },
    });
  };
};

export default resendOTP;