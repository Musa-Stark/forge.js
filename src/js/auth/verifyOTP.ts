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
import { getEnvs } from "../config/envs.js";

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
    // get dynamic auth field keys
    const { authConfigObj } = getEnvs();
    const { fieldsObj } = authConfigObj;

    const emailKey = fieldsObj?.email;
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
        message: `${emailKey}, ${otpKey} and ${purposeKey} are required.`,
        statusCode: 400,
        hint: `Check if ${emailKey}, ${otpKey} or ${purposeKey} is missing in collection -> validationsObj -> ${routeObj.validationKey}.`,
        details: getErrorDetail(routeObj),
      });

    // OTPModel: otp model
    const OTPModel = getOTPModel(routeObj)!;

    const OTPData = await OTPModel.findOne({
      [emailKey!]: body[emailKey!],
      [purposeKey!]: body[purposeKey!],
    }).select("+password");

    // if otp request not found
    if (!OTPData)
      throw new AppError({
        message: "OTP request not found.",
        statusCode: 404,
        hint: `Request a new OTP or verify the provided ${emailKey} and ${purposeKey}.`,
        details: getErrorDetail(routeObj),
      });

    // if otp already verified
    if (OTPData.isVerified) {
      appResponse({
        res,
        message: `${body[purposeKey!]}: OTP has already been verified.`,
        data:
          body[purposeKey!] === "password_reset"
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



    // if otp didn't match
    const isValid = await verifyHash(
      body[otpKey!] as string,
      OTPData[otpKey!],
      routeObj
    );

    if (!isValid) {
      await OTPModel.updateOne(
        { _id: OTPData._id },
        { $inc: { otpCount: 1 } }
      );

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
      { $set: { isVerified: true } }
    );

    // purpose: func - map
    const purposeMap = {
      signup: createUser,
      login: authenticateUser,
      password_reset: otpVerifiedResponse,
    };

    // call func via map
    purposeMap[OTPData[purposeKey!] as keyof typeof purposeMap]({
      body: OTPData,
      res,
      routeName,
      modelName,
      routeObj,
      req,
    });
  };
};

export default verifyOTP;