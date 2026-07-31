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
import getErrorDetail from "../utils/getErrorDetail.js";


const resendOTP = ({
  modelName,
  routeName,
  validationsObj,
  routeObj,
}: {
  modelName: string;
  routeName: string;
  validationsObj: ValidationsObj;
  routeObj: Route;
}) => {
  return async (req: Request, res: Response) => {
    // validationObj
    const validationObj = getValidationKey(routeObj, validationsObj);

    // validate
    const body = validate(validationObj, req.body, routeObj);

    // if body.purpose not found
    if (!req.body.purpose || !req.body.email)
      throw new AppError({
        message: "email and purpose are required.",
        statusCode: 400,
        code: "VALIDATION_REQUIRED_FIELD_MISSING",
        hint: 'Provide email and purpose (e.g. "login", "signup", "password_reset") in the request body.',
        details: getErrorDetail(routeObj),
      });

    // if user not found
    await getUser({
      modelName,
      routeName,
      email: body.email as string,
      routeObj
    });

    // get otp user
    const OTPUser = await getOTPUser({
      email: body.email as string,
      purpose: body.purpose as string,
      routeObj,
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
    const { OTP, otpExpiry } = await sendOTP(body.email as string, routeObj);
    const hashedOTP = await hash(OTP, routeObj);

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