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

const verifyOTP = ({
  modelName,
  validationsObj,
  routeName,
  route,
}: {
  modelName: string;
  validationsObj: ValidationsObj;
  routeName: string;
  route: Route;
}) => {
  return async (req: Request, res: Response) => {
    // validationObj
    const validationObj = getValidationKey(route, validationsObj);

    // validate
    const body = validate(validationObj, req.body, route);

    // if body.purpose not found
    if (!req.body.purpose || !req.body.email || !req.body.otp)
      throw new AppError({
        message: "email, otp and purpose are required.",
        statusCode: 400,
        code: "VALIDATION_REQUIRED_FIELD_MISSING",
        hint: "Provide email, otp and purpose in the request body.",
        details: {
          handler: route.handler,
          method: route.method,
          path: route.path,
        },
      });

    // OTPModel: otp model
    const OTPModel = getOTPModel(route)!;

    const OTPData = await OTPModel?.findOne({
      email: body.email,
      purpose: body.purpose,
    }).select("+password");

    // if otp request not found
    if (!OTPData)
      throw new AppError({
        message: "OTP request not found.",
        statusCode: 404,
        code: "CRUD_ITEM_NOT_FOUND",
        hint: "Request a new OTP or verify the provided email and purpose.",
        details: {
          handler: route.handler,
          method: route.method,
          path: route.path,
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
        message: "Maximum OTP verification attempts exceeded.",
        statusCode: 429,
        code: "AUTH_FORBIDDEN",
        hint: "Request a new OTP before trying again.",
        details: {
          handler: route.handler,
          method: route.method,
          path: route.path,
        },
      });

    // if otp expired
    if (new Date() > OTPData.otpExpiry)
      throw new AppError({
        message: "OTP has expired.",
        statusCode: 409,
        code: "AUTH_TOKEN_EXPIRED",
        hint: "Request a new OTP and try again.",
        details: {
          handler: route.handler,
          method: route.method,
          path: route.path,
        },
      });

    // if otp didn't matched
    const isValid = await verifyHash(body.otp as string, OTPData.OTP, route);
    if (!isValid) {
      await OTPModel.updateOne({ _id: OTPData._id }, { $inc: { otpCount: 1 } });

      throw new AppError({
        message: "Invalid OTP.",
        statusCode: 409,
        code: "AUTH_TOKEN_INVALID",
        hint: "Verify the OTP and try again.",
        details: {
          handler: route.handler,
          method: route.method,
          path: route.path,
        },
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
      route,
    });
  };
};

export default verifyOTP;
