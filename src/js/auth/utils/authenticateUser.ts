import AppError from "../../utils/AppError.js";
import type { Request, Response } from "express";
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
import saveRefreshToken from "../../utils/saveRefreshToken.js";
import tokenInfo from "./UAParser.js";
import { hash } from "../../utils/libsodium.js";

const authenticateUser = async ({
  body,
  model,
  res,
  req,
  route,
  routeObj,
}: {
  body: any;
  model: string;
  res: Response;
  req: Request;
  route: string;
  routeObj: Route;
}) => {
  // get dynamic auth field keys
  const { authConfigObj } = getEnvs();
  const { fieldsObj } = authConfigObj;

  const emailKey = fieldsObj?.email;
  const passwordKey = fieldsObj?.password;
  const otpKey = fieldsObj?.otp;
  const purposeKey = fieldsObj?.purpose;

  // otp model
  const OTPModel = getOTPModel(routeObj);

  // token info
  const { deviceType, familyId, jti, deviceName, ipAddress, os } =
    tokenInfo(req);

  // handle is verified
  let isVerified = false;
  let isOTPUser: any = null;

  if ("isVerified" in body)
    ({ isVerified, isOTPUser } = await handleIsVerified({
      email: body[emailKey!] as string,
      purpose: "login",
      routeObj,
    }));

  // user
  const user = await getUser({
    model,
    route,
    email: body[emailKey!] as string,
    needPassword: true,
    routeObj,
  });

  // invalid password - credentials mode
  if (!isOTPUser) {
    const isValid = await verifyHash(
      body[passwordKey!],
      user.password,
      routeObj
    );

    if (!isValid)
      throw new AppError({
        message: "Invalid password.",
        statusCode: 409,
        hint: `Verify your ${passwordKey} and try again.`,
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
    ipAddress,
    os,
  });

  // send response
  appResponse({
    res,
    message: "Authenticated successfully!",
    statusCode: 200,
    data: sanitizeOne(user.toObject(), routeObj),
    accessToken: authConfigObj?.returnAccessToken ? accessToken! : undefined,
    refreshToken: authConfigObj?.returnRefreshToken ? refreshToken! : undefined,
    purpose: body[purposeKey!],
  });
};

export default authenticateUser;