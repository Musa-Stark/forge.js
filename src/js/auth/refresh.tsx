import type { Route } from "../types/Collection.ts";
import type { Request, Response } from "express";
import AppError from "../utils/AppError.js";
import getErrorDetail from "../utils/getErrorDetail.js";
import { verifyJWT } from "../utils/handleJWT.js";
import { findUser } from "../middleware/auth.middleware.js";
import { sendCookie } from "./utils/sendCookie.js";
import appResponse from "../utils/response.js";
import { getEnvs } from "../config/envs.js";
import { verifyHash } from "../utils/libsodium.js";
import getModel from "../utils/getModel.js";
import tokenInfo from "./utils/UAParser.js";
import saveRefreshToken from "../utils/saveRefreshToken.js";
import { hash } from "../utils/libsodium.js";

const refresh = ({
  routeObj,
}: {
  routeObj: Route;
}) => {
  return async (req: Request, res: Response) => {
    const { authConfigObj, userModelName } = getEnvs();

    const rotateRefreshToken = true;

    // token info
    const { deviceType, jti, deviceName, os, ipAddress } = tokenInfo(req);

    // refreshToken
    let token = req.cookies?.[authConfigObj.refreshTokenName!];

    // token not found - re-login
    if (!token)
      throw new AppError({
        message: "Refresh token is missing",
        code: "REFRESH_TOKEN_MISSING",
        details: getErrorDetail(routeObj),
        hint: "Sign in again to create a new authentication session.",
        statusCode: 401,
      });

    // payload
    const payload = verifyJWT({
      token,
      routeObj,
    });

    // if payload is not as string or sub isn't found in it
    if (typeof payload === "string" || !payload.sub || !payload.jti)
      throw new AppError({
        message: "Refresh token payload is invalid",
        code: "REFRESH_TOKEN_PAYLOAD_INVALID",
        statusCode: 401,
        hint: "Sign in again to obtain a valid refresh token.",
        details: getErrorDetail(routeObj),
      });

    // refresh model
    const RefreshToken = getModel({ modelName: "RefreshToken", routeObj });

    // find same device tokens
    const foundRefreshToken = await RefreshToken.findOne({
      owner: payload.sub,
      jti: payload.jti,
    });

    // tokens not found
    if (!foundRefreshToken)
      throw new AppError({
        message: "Refresh token session was not found",
        code: "REFRESH_TOKEN_NOT_FOUND",
        hint: "Sign in again to create a new authentication session.",
        details: getErrorDetail(routeObj),
        statusCode: 401,
      });

    // if token is revoked
    if (foundRefreshToken.revoked)
      throw new AppError({
        message: "Refresh token has been revoked",
        code: "REFRESH_TOKEN_REVOKED",
        statusCode: 401,
        hint: "Sign in again to create a new authentication session.",
        details: getErrorDetail(routeObj),
      });

    // check if valid token
    const isValid = await verifyHash(
      token,
      foundRefreshToken.refreshTokenHash,
      routeObj,
    );
    if (!isValid) {
      await RefreshToken.updateOne(
        {
          owner: payload.sub,
          jti: payload.jti,
          revoked: false,
        },
        { $set: { revoked: true } },
      );
      throw new AppError({
        message: "Refresh token is invalid",
        code: "REFRESH_TOKEN_INVALID",
        statusCode: 401,
        hint: "Sign in again to create a new authentication session.",
        details: getErrorDetail(routeObj),
      });
    }

    // find user
    const user = await findUser(
      payload.sub as string,
      routeObj,
      userModelName as string,
    );

    // if user not found
    if (!user)
      throw new AppError({
        message: "User associated with the refresh token was not found",
        code: "REFRESH_USER_NOT_FOUND",
        statusCode: 401,
        hint: "Sign in again with an existing account.",
        details: getErrorDetail(routeObj),
      });

    // send access cookie
    const { accessToken } = sendCookie({
      res,
      accessTokenName: authConfigObj.accessTokenName!,
      routeObj,
      accessTokenPayload: {
        sub: payload.sub,
      },
    });

    // rotateRefreshToken or update last used
    if (!rotateRefreshToken) {
      // update lastUsed
      await RefreshToken.updateOne(
        {
          owner: payload.sub,
          jti: payload.jti,
          revoked: false,
        },
        { $set: { lastUsedAt: Date.now() } },
      );
    } else {
      // cookie
      const { refreshToken, refreshTokenAge } = sendCookie({
        deviceType,
        refreshTokenName: authConfigObj.refreshTokenName!,
        jti,
        familyId: payload.familyId,
        refreshTokenPayload: {
          sub: payload.sub,
        },
        res,
        routeObj,
      });

      token = refreshToken;

      // hashedToken
      const hashedToken = await hash(refreshToken!);

      // check if old token
      await RefreshToken.updateMany(
        {
          owner: payload.sub,
          refreshTokenHash: { $ne: hashedToken },
          familyId: payload.familyId,
          revoked: false,
        },
        { $set: { revoked: true } },
      );

      await saveRefreshToken({
        _id: payload.sub,
        familyId: payload.familyId,
        jti,
        hashedToken,
        refreshTokenAge,
        routeObj,
        deviceName,
        deviceType,
        ipAddress,
        os,
      });
    }

    // response
    appResponse({
      res,
      message: "Access token refreshed successfully",
      accessToken: authConfigObj?.returnAccessToken ? accessToken! : undefined,
      refreshToken: authConfigObj?.returnRefreshToken ? token! : undefined,
    });
  };
};

export default refresh;
