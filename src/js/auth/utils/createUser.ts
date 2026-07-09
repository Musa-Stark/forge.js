import AppError from "../../utils/AppError.js";
import registerModel from "../../lib/model.registry.js";
import type { Response } from "express";
import appResponse from "../../utils/response.js";
import { sanitizeItem } from "../../utils/sanitize.js";
import mongoose from "mongoose";
import { hash } from "../../utils/libsodium.js";

const createUser = async ({
  body,
  modelName,
  res,
}: {
  body: any;
  modelName: string;
  res: Response;
}) => {
  const Model = registerModel[modelName];
  // if model not found
  if (!Model)
    throw new AppError({
      message: `Model: ${modelName} not found to create user`,
      statusCode: 404,
    });

  const OTPModel = registerModel["otpUser"];
  // if otp-model not created
  if (!OTPModel)
    throw new AppError({
      message: "OTP verification service is currently unavailable.",
      statusCode: 409,
    });

  // if otpUser
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

  if (body instanceof mongoose.Document) {
    body = body.toObject();
    delete body._id;
  } else {
    body.password = await hash(body.password)
  }

  const newUser = await Model.create(body);
  if (isVerified) await OTPModel.deleteOne({ _id: isOTPUser._id });

  appResponse({
    res,
    message: "Your account has been created successfully.",
    statusCode: 201,
    data: sanitizeItem(newUser.toObject()),
  });
};

export default createUser;
