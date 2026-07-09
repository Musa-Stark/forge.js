import type { ValidationsObj } from "../types/ValidationsObj.js";
import type { Request, Response } from "express";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import registerModel from "../lib/model.registry.js";
import { verifyHash } from "../utils/libsodium.js";
import createUser from "./utils/createUser.js";

const verifyOTP = ({
  modelName,
  validationsObj,
}: {
  modelName: string;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response) => {
    const body = validate(validationsObj!.verifyOTP, req.body);
    const Model = registerModel["otpUser"];

    // if model not created
    if (!Model)
      throw new AppError({
        message: "OTP verification service is currently unavailable.",
        statusCode: 409,
      });

    const OTPData = await Model?.findOne({ email: body.email }).select(
      "+password",
    );

    // if otp request not found
    if (!OTPData)
      throw new AppError({
        message: "No OTP request was found for the provided email address.",
        statusCode: 409,
      });

    // if otp try limit reached
    if (OTPData.otpCount > OTPData.maxOtpTries)
      throw new AppError({
        message:
          "The maximum number of OTP verification attempts has been exceeded. Please request a new OTP.",
        statusCode: 429,
      });

    // if otp expired
    if (new Date() > OTPData.otpExpiry)
      throw new AppError({
        message: "The OTP has expired. Please request a new one.",
        statusCode: 409,
      });

    // if otp didn't matched
    const isValid = await verifyHash(body.otp as string, OTPData.OTP);
    if (!isValid) {
      // increment otpCount
      await Model.updateOne({ _id: OTPData._id }, { $inc: { otpCount: 1 } });

      throw new AppError({
        message: "Invalid OTP. Please try again.",
        statusCode: 409,
      });
    }

    // if for signup
    if (OTPData.purpose === "signup") {
      await Model.updateOne(
        { _id: OTPData._id },
        { $set: { isVerified: true } },
      );
      // call create user
      createUser({ body: OTPData, res, modelName });
    }

    await Model.updateOne({ _id: OTPData._id }, { $set: { isVerified: true } });
  };
};

export default verifyOTP;
