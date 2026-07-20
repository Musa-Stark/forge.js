import AppError from "../../utils/AppError.js";
import type { Response } from "express";
import appResponse from "../../utils/response.js";
import { verifyHash } from "../../utils/libsodium.js";
import { sanitizeOne } from "../../utils/sanitize.js";
import handleIsVerified from "./handleIsVerified.js";
import getOTPModel from "./getOTPModel.js";
import getUser from "./getUser.js";
import { sendCookie } from "./sendCookie.js";
import type { Route } from "../../types/Collection.js";

const authenticateUser = async ({
  body,
  modelName,
  res,
  routeName,
  route
}: {
  body: any;
  modelName: string;
  res: Response;
  routeName: string;
  route: Route
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
    const isValid = await verifyHash(body.password, user.password, route);
    if (!isValid)
      throw new AppError({ message: "Invalid password", statusCode: 409 });
  }

  //   remove from otpmodel
  if (isVerified) await OTPModel!.deleteOne({ _id: body._id });

  const { _id } = user.toObject();

  // send cookied
  sendCookie({ res, cookieName: "authToken", payload: { sub: _id }, route });

  // send response
  appResponse({
    res,
    message: "Authenticated successfully!",
    statusCode: 200,
    data: sanitizeOne(user.toObject()),
  });
};

export default authenticateUser;
