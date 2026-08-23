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
import getErrorDetail from "../../utils/getErrorDetail.js";
import { getEnvs } from "../../config/envs.js";

const authenticateUser = async ({
  body,
  modelName,
  res,
  routeName,
  routeObj,
}: {
  body: any;
  modelName: string;
  res: Response;
  routeName: string;
  routeObj: Route;
}) => {
  // otp model
  const OTPModel = getOTPModel(routeObj);

  // returnAccessToken
  const { authConfigObj } = getEnvs();

  // handle is verified
  let isVerified = false;
  let isOTPUser: any = null;

  if ("isVerified" in body)
    ({ isVerified, isOTPUser } = await handleIsVerified({
      email: body.email as string,
      purpose: "login",
      routeObj,
    }));

  // user
  const user = await getUser({
    modelName,
    routeName,
    email: body.email as string,
    needPassword: true,
    routeObj,
  });

  // invalid password - credentials mode
  if (!isOTPUser) {
    const isValid = await verifyHash(body.password, user.password, routeObj);

    if (!isValid)
      throw new AppError({
        message: "Invalid password.",
        statusCode: 409,
        hint: "Verify your password and try again.",
        details: getErrorDetail(routeObj),
      });
  }

  // remove from otp model
  if (isVerified)
    await OTPModel!.deleteOne({
      _id: body._id,
    });

  const { _id } = user.toObject();

  // send cookie
  const token = sendCookie({
    res,
    cookieName: "authToken",
    payload: { sub: _id },
    routeObj,
  });

  // send response
  appResponse({
    res,
    message: "Authenticated successfully!",
    statusCode: 200,
    data: sanitizeOne(user.toObject(), routeObj),
    accessToken: authConfigObj?.returnAccessToken ? token : undefined,
  });
};

export default authenticateUser;
