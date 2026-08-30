import type { Route } from "../types/Collection.ts";
import type { Request, Response } from "express";
import AppError from "../utils/AppError.js";
import getErrorDetail from "../utils/getErrorDetail.js";
import { verifyJWT } from "../utils/handleJWT.js";
import { sendCookie } from "./utils/sendCookie.js";
import appResponse from "../utils/response.js";
import { getEnvs } from "../config/envs.js";
import tokenInfo from "./utils/UAParser.js";
import findRefreshToken from "./utils/findRefreshToken.js";
import handleRefreshTokenValidation from "./utils/handleRefreshTokenValidation.js";
import findRefreshTokenUser from "./utils/findRefreshTokenUser.js";
import handleRotateRefreshToken from "./utils/handleRotateRefreshToken.js";
import getRefreshToken from "./utils/handleGetToken.js";

const refresh = ({ routeObj }: { routeObj: Route }) => {
  return async (req: Request, res: Response) => {
    const { authConfigObj } = getEnvs();

    // token info
    const { deviceType, jti, deviceName, os, ipAddress, familyId } =
      tokenInfo(req);

    // refreshToken
    let token = getRefreshToken({
      req,
      routeObj,
      type: "refreshTokenName",
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
        hint: "Log in again to obtain a valid refresh token.",
        details: getErrorDetail(routeObj),
      });

    // check if valid token
    await handleRefreshTokenValidation(
      token,
      routeObj,
      payload.sub,
      payload.jti,
    );

    // find user - if exists
    await findRefreshTokenUser(payload.sub, routeObj);

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
    await handleRotateRefreshToken({
      deviceName: deviceName!,
      deviceType,
      familyId,
      ipAddress: ipAddress!,
      currentTokenJTI: payload.jti,
      rotateTokenJTI: jti,
      os,
      owner: payload.sub,
      res,
      routeObj,
      iat: payload.iat as number,
    });

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
