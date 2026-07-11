import AppError from "../../utils/AppError.js";
import type { Response } from "express";
import appResponse from "../../utils/response.js";
import { verifyHash } from "../../utils/libsodium.js";
import { sanitizeItem } from "../../utils/sanitize.js";
import handleIsVerified from "./handleIsVerified.js";
import getModel from "./getModel.js";
import getOTPModel from "./getOTPModel.js";
import getUser from "./getUser.js";

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
  // otp model
  const OTPModel = getOTPModel();

  // handle is verified
  let isVerified: boolean = false;
  let isOTPUser: any = null;
  if ("isVerified" in body)
    ({ isVerified, isOTPUser } = await handleIsVerified({
      email: body.email as string,
      purpose: "login",
    }));

  // user
  const user = await getUser({
    modelName,
    routeName,
    email: body.email as string,
    needPassword: true,
  });

  //   invalid password - not otpuser - mode credentials
  if (!isOTPUser) {
    const isValid = await verifyHash(body.password, user.password);
    if (!isValid)
      throw new AppError({ message: "Invalid password", statusCode: 409 });
  }

  //   remove from otpmodel
  if (isVerified) await OTPModel!.deleteOne({ _id: body._id });

  appResponse({
    res,
    message: "Authenticated successfully!",
    statusCode: 200,
    data: sanitizeItem(user.toObject()),
  });
};

export default authenticateUser;
