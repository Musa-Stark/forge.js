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
import { getEnvs } from "../config/envs.js";

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
    // get dynamic auth field keys
    const { authConfigObj } = getEnvs();
    const { fieldsObj } = authConfigObj;

    const emailKey = fieldsObj?.email;
    const passwordKey = fieldsObj?.password;
    const otpKey = fieldsObj?.otp;
    const purposeKey = fieldsObj?.purpose;

    // validationObj
    const validationObj = getValidationKey(routeObj, validationsObj);

    // validate
    const body = validate(validationObj, req.body, routeObj);

    // if required fields not found
    if (
      !req.body?.[emailKey!] ||
      !req.body?.[otpKey!] ||
      !req.body?.[purposeKey!]
    )
      throw new AppError({
        message: `${emailKey}, ${otpKey}, and ${purposeKey} are required.`,
        statusCode: 400,
        hint: `Provide ${emailKey}, ${otpKey}, and ${purposeKey} in the request body.`,
        details: getErrorDetail(routeObj),
      });

    // if user not found
    await getUser({
      modelName,
      routeName,
      email: body[emailKey!] as string,
      routeObj,
    });

    // get otp user
    const OTPUser = await getOTPUser({
      email: body[emailKey!] as string,
      purpose: body[purposeKey!] as string,
      routeObj,
    });

    // if otp already verified
    if (OTPUser.isVerified) {
      appResponse({
        res,
        message: `${body[purposeKey!]}: OTP has already been verified.`,
        data: undefined,
      });
      return;
    }

    // send OTP
    const { OTP, otpExpiry } = await sendOTP(
      body[emailKey!] as string,
      routeObj
    );

    const hashedOTP = await hash(OTP, routeObj);

    OTPUser.otpCount = 0;
    OTPUser[otpKey!] = hashedOTP;
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
        nextStep: `go to /verify-otp with ${purposeKey}: ${req.body[purposeKey!]}`,
      },
    });
  };
};

export default resendOTP;