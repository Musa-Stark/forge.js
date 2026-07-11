import type { Request, Response } from "express";
import type { ValidationsObj } from "../types/Collection.ts";
import validate from "../utils/validate.js";
import AppError from "../utils/AppError.js";
import sendOTP from "./utils/sendOTP.js";
import { hash } from "../utils/libsodium.js";
import appResponse from "../utils/response.js";
import getModel from "./utils/getModel.js";
import getOTPUser from "./utils/getOTPUser.js";

const resendOTP = ({
  modelName,
  routeName,
  validationsObj,
}: {
  modelName: string;
  routeName: string;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response) => {
    // validate
    const body = validate(validationsObj.resendOTP, req.body);
    const Model = getModel({ modelName, routeName });

    // if user not found
    const user = await Model.findOne({ email: body.email });
    if (!user)
      throw new AppError({ message: "User not found.", statusCode: 404 });

    // get otpuser
    const OTPUser = await getOTPUser(body.email as string);

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
