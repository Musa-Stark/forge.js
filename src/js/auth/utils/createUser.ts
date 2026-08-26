import type { Response, Request } from "express";
import appResponse from "../../utils/response.js";
import { sanitizeOne } from "../../utils/sanitize.js";
import mongoose from "mongoose";
import { hash } from "../../utils/libsodium.js";
import getModel from "../../utils/getModel.js";
import getOTPModel from "./getOTPModel.js";
import handleIsVerified from "./handleIsVerified.js";
import { sendCookie } from "./sendCookie.js";
import type { Route } from "../../types/Collection.js";
import { getEnvs } from "../../config/envs.js";
import tokenInfo from "./UAParser.js";
import saveRefreshToken from "../../utils/saveRefreshToken.js";

const createUser = async ({
  body,
  modelName,
  res,
  routeName,
  routeObj,
  req,
}: {
  body: any;
  modelName: string;
  res: Response;
  routeName: string;
  routeObj: Route;
  req: Request;
}) => {
  // get dynamic auth field keys
  const { authConfigObj } = getEnvs();
  const { fieldsObj } = authConfigObj;

  const emailKey = fieldsObj?.email;
  const passwordKey = fieldsObj?.password;
  const otpKey = fieldsObj?.otp;
  const purposeKey = fieldsObj?.purpose;

  // models
  const Model = getModel({ modelName, routeName, routeObj });
  const OTPModel = getOTPModel(routeObj);

  // token info
  const { deviceType, familyId, jti, deviceName, ipAddress, os } =
    tokenInfo(req);

  // isVerified - mode:otp
  let isVerified: boolean = false;
  let isOTPUser: any = null;

  if ("isVerified" in body)
    ({ isVerified, isOTPUser } = await handleIsVerified({
      email: body[emailKey!] as string,
      purpose: "signup",
      routeObj,
    }));

  // delete body._id | hash password
  if (body instanceof mongoose.Document) {
    body = body.toObject();
    body.role = "user";
    delete body._id;
  } else {
    body[passwordKey!] = await hash(body[passwordKey!], routeObj);
    body.role = "user";
  }

  // new user
  const newUser = await Model.create(body);

  // if from otp, remove it
  if (isVerified)
    await OTPModel.deleteOne({ _id: isOTPUser._id });

  const { _id } = newUser.toObject();

  // send cookie
  const { accessToken, refreshToken, refreshTokenAge } = sendCookie({
    res,
    accessTokenName: authConfigObj.accessTokenName!,
    refreshTokenName: authConfigObj.refreshTokenName!,
    accessTokenPayload: { sub: _id },
    refreshTokenPayload: { sub: _id },
    routeObj,
    deviceType,
    familyId,
    jti,
  });

  // save refreshToken
  const hashedToken = await hash(refreshToken!);

  await saveRefreshToken({
    hashedToken,
    refreshTokenAge,
    _id,
    routeObj,
    jti: jti as string,
    familyId,
    deviceName,
    deviceType,
    os,
    ipAddress,
  });

  // send response
  appResponse({
    res,
    message: "Your account has been created successfully!",
    statusCode: 201,
    data: sanitizeOne(newUser.toObject(), routeObj),
    accessToken: authConfigObj?.returnAccessToken ? accessToken! : undefined,
    refreshToken: authConfigObj?.returnRefreshToken ? refreshToken! : undefined,
    purpose: body[purposeKey!],
  });
};

export default createUser;