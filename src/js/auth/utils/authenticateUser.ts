import registerModel from "../../lib/model.registry.js";
import AppError from "../../utils/AppError.js";
import type { Response } from "express";
import appResponse from "../../utils/response.js";
import { verifyHash } from "../../utils/libsodium.js";
import { sanitizeItem } from "../../utils/sanitize.js";
import handleIsVerified from "./handleIsVerfieid.js";
import getModel from "./getModel.js";
import getOTPModel from "./getOTPModel.js";

const authenticateUser = async ({
  body,
  modelName,
  res,
  routeName,
}: {
  body: any;
  modelName: string;
  res: Response;
  routeName: string;
}) => {
  // model
  const Model = getModel({ modelName, routeName })!;

  const OTPModel = getOTPModel();
  // if otp-model not created
  if (!OTPModel)
    throw new AppError({
      message: "OTP verification service is currently unavailable.",
      statusCode: 409,
    });

  // handle is verified
  let isVerified: boolean = false;
  let isOTPUser: any = null;
  if ("isVerified" in body)
    ({ isVerified, isOTPUser } = await handleIsVerified(body.email as string));

  // foundUser
  const foundUser = await Model?.findOne({ email: body.email }).select(
    "+password",
  );

  // user not found
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
