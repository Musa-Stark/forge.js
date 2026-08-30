import type { Request, Response } from "express";
import { clearCookie } from "./utils/sendCookie.js";
import appResponse from "../utils/response.js";
import type { Route } from "../types/Collection.js";
import { getEnvs } from "../config/envs.js";
import getToken from "./utils/handleGetToken.js";
import { verifyJWT } from "../utils/handleJWT.js";
import AppError from "../utils/AppError.js";
import getErrorDetail from "../utils/getErrorDetail.js";
import getModel from "../utils/getModel.js";
import handleRefreshTokenValidation from "./utils/handleRefreshTokenValidation.js";

const logout = (routeObj: Route) => {
  const { authConfigObj } = getEnvs();

  return async (req: Request, res: Response) => {
    const token = getToken({ req, routeObj, type: "refreshTokenName" });

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

    // refreshToken model
    const RefreshToken = getModel({ modelName: "RefreshToken", routeObj });

    // handleRefreshTokenValidation
    await handleRefreshTokenValidation(
      token,
      routeObj,
      payload.sub,
      payload.jti,
    );

    // revoke all of the same family
    await RefreshToken.updateMany(
      { familyId: payload.familyId },
      { $set: { revoked: true } },
    );

    clearCookie({ res, cookieName: authConfigObj.refreshTokenName!, routeObj });
    clearCookie({ res, cookieName: authConfigObj.accessTokenName!, routeObj });

    appResponse({ res, message: "Logged out successfully!" });
  };
};
export default logout;
