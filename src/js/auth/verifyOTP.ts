import type { Request, Response } from "express";
import type { ValidationsObj } from "../types/Collection.js";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import { verifyHash } from "../utils/libsodium.js";
import createUser from "./utils/createUser.js";
import authenticateUser from "./utils/authenticateUser.js";
import getOTPModel from "./utils/getOTPModel.js";
import otpVerifiedResponse from "./utils/otpVerifiedResponse.js";
import appResponse from "../utils/response.js";

const verifyOTP = ({
  modelName,
  validationsObj,
  routeName,
}: {
  modelName: string;
  validationsObj: ValidationsObj;
  routeName: string;
}) => {
  return async (req: Request, res: Response) => {
    const body = validate(validationsObj.verifyOTP, req.body);

    // if body.purpose not found
    if (!req.body.purpose || !req.body.email || !req.body.otp)
      throw new AppError({
        message:
          "collection error: email, otp and purpose are required to verify otp in validationsObj",
        statusCode: 409,
      });

    // OTPModel: otp model
    const OTPModel = getOTPModel()!;

    const OTPData = await OTPModel?.findOne({
      email: body.email,
      purpose: body.purpose,
    }).select("+password");

    // if otp request not found
    if (!OTPData)
      throw new AppError({
        message: "No OTP request was found for the provided email address.",
        statusCode: 409,
        data: {
          nextStep: "login or signup",
        },
      });

    // if otp already verified
    if (OTPData.isVerified) {
      appResponse({
        res,
        message: `${body.purpose}: OTP has already been verified.`,
        data:
          body.purpose === "password_reset"
            ? {
                nextStep: "go to /reset-password",
              }
            : undefined,
      });
      return;
    }

    // if otp try limit reached
    if (OTPData.otpCount > OTPData.maxOTPTries)
      throw new AppError({
        message:
          "The maximum number of OTP verification attempts has been exceeded. Please request a new OTP.",
        statusCode: 429,
        data: {
          nextStep: "request another OTP",
        },
      });

    // if otp expired
    if (new Date() > OTPData.otpExpiry)
      throw new AppError({
        message: "The OTP has expired. Please request a new one.",
        statusCode: 409,
        data: {
          nextStep: "request another OTP",
        },
      });

    // if otp didn't matched
    const isValid = await verifyHash(body.otp as string, OTPData.OTP);
    if (!isValid) {
      // increment otpCount
      await OTPModel.updateOne({ _id: OTPData._id }, { $inc: { otpCount: 1 } });

      throw new AppError({
        message: "Invalid OTP. Please try again.",
        statusCode: 409,
      });
    }

    // update - isVerified: true
    await OTPModel.updateOne(
      { _id: OTPData._id },
      { $set: { isVerified: true } },
    );

    // purpose: func - map
    const purposeMap = {
      signup: createUser,
      login: authenticateUser,
      password_reset: otpVerifiedResponse,
    };

    // call func via map
    purposeMap[OTPData.purpose as keyof typeof purposeMap]({
      body: OTPData,
      res,
      routeName,
      modelName,
    });
  };
};

export default verifyOTP;
