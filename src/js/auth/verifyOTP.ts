import type { Request, Response } from "express";
import type { Route, ValidationsObj } from "../types/Collection.js";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import { verifyHash } from "../utils/libsodium.js";
import createUser from "./utils/createUser.js";
import authenticateUser from "./utils/authenticateUser.js";
import getOTPModel from "./utils/getOTPModel.js";
import otpVerifiedResponse from "./utils/otpVerifiedResponse.js";
import appResponse from "../utils/response.js";
import getValidationKey from "../utils/validationKeyError.js";
import getErrorDetail from "../utils/getErrorDetail.js";


const verifyOTP = ({
  modelName,
  validationsObj,
  routeName,
  routeObj,
}: {
  modelName: string;
  validationsObj: ValidationsObj;
  routeName: string;
  routeObj: Route;
}) => {
  return async (req: Request, res: Response) => {
    // validationObj
    const validationObj = getValidationKey(routeObj, validationsObj);

    // validate
    const body = validate(validationObj, req.body, routeObj);

    // if body.purpose not found
    if (!req.body.purpose || !req.body.email || !req.body.otp)
      throw new AppError({
        message: "email, otp and purpose are required.",
        statusCode: 400,
        hint: `Checkout if email, otp or purpose is missing in collection -> validationsObj -> ${routeObj.validationKey}.`,
        details: getErrorDetail(routeObj),
      });

    // OTPModel: otp model
    const OTPModel = getOTPModel(routeObj)!;

    const OTPData = await OTPModel?.findOne({
      email: body.email,
      purpose: body.purpose,
    }).select("+password");

    // if otp request not found
    if (!OTPData)
      throw new AppError({
        message: "OTP request not found.",
        statusCode: 404,
        hint: "Request a new OTP or verify the provided email and purpose.",
        details: getErrorDetail(routeObj),
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
        message: "Maximum OTP verification attempts exceeded.",
        statusCode: 429,
        hint: "Request a new OTP before trying again.",
        details: getErrorDetail(routeObj),
      });

    // if otp expired
    if (new Date() > OTPData.otpExpiry)
      throw new AppError({
        message: "OTP has expired.",
        statusCode: 409,
        hint: "Request a new OTP and try again.",
        details: getErrorDetail(routeObj),
      });

    // if otp didn't matched
    const isValid = await verifyHash(body.otp as string, OTPData.OTP, routeObj);
    if (!isValid) {
      await OTPModel.updateOne({ _id: OTPData._id }, { $inc: { otpCount: 1 } });

      throw new AppError({
        message: "Invalid OTP.",
        statusCode: 409,
        hint: "Verify the OTP and try again.",
        details: getErrorDetail(routeObj),
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
      routeObj,
      req
    });
  };
};

export default verifyOTP;
