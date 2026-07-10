import registerModel from "../../lib/model.registry.js";
import AppError from "../../utils/AppError.js";
import type { Response } from "express";
import appResponse from "../../utils/response.js";
import { verifyHash } from "../../utils/libsodium.js";
import { sanitizeItem } from "../../utils/sanitize.js";

const authenticateUser = async ({
  body,
  modelName,
  res,
}: {
  body: any;
  modelName: string;
  res: Response;
}) => {
  const Model = registerModel[modelName];
  if (!Model)
    throw new AppError({
      message: `Model: ${modelName} not found to find user`,
      statusCode: 404,
    });

  const OTPModel = registerModel["otpUser"];
  // if otp-model not created
  if (!OTPModel)
    throw new AppError({
      message: "OTP verification service is currently unavailable.",
      statusCode: 409,
    });

  // if otpUser - mode otp
  const isOTPUser = await OTPModel.findOne({ email: body.email });
  let isVerified = false;
  if (isOTPUser) {
    // if isVerfied
    if (isOTPUser.isVerified) {
      isVerified = true;
    } else {
      // if not verified
      throw new AppError({
        message: "Please verify your email address before creating an account.",
        statusCode: 409,
      });
    }
  }

  // foundUser
  const foundUser = await Model?.findOne({ email: body.email }).select(
    "+password",
  );

  //   user not found
  if (!foundUser)
    throw new AppError({ message: "User not found.", statusCode: 404 });

  //   invalid password - not otpuser - mode credentials
  if (!isOTPUser) {
    const isValid = await verifyHash(body.password, foundUser.password);
    if (!isValid)
      throw new AppError({ message: "Invalid password", statusCode: 409 });
  }

  //   remove from otpmodel
  if (isVerified) await OTPModel!.deleteOne({ _id: body._id });

  appResponse({
    res,
    message: "Authenticated successfully!",
    statusCode: 200,
    data: sanitizeItem(foundUser.toObject()),
  });
};

export default authenticateUser;
