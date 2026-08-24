import type { Route, ValidationsObj } from "../types/Collection.ts";
import type { Request, Response } from "express";
import AppError from "../utils/AppError.js";
import getErrorDetail from "../utils/getErrorDetail.js";
import { verifyJWT } from "../utils/handleJWT.js";
import { findUser } from "../middleware/auth.middleware.js";
import { sendCookie } from "./utils/sendCookie.js";
import appResponse from "../utils/response.js";
import { getEnvs } from "../config/envs.js";

const refresh = ({
  routeObj,
}: {
  modelName: string;
  routeObj: Route;
  routeName: string;
  validationsObj: ValidationsObj;
}) => {
  return async (req: Request, res: Response) => {
    const { authConfigObj, userModelName } = getEnvs();

    // refreshToken
    const token = req.cookies?.[authConfigObj.refreshTokenName!];

    // authConfigObj

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
    if (typeof payload === "string" || !payload.sub)
      throw new AppError({
        message: "Refresh token payload is invalid",
        code: "REFRESH_TOKEN_PAYLOAD_INVALID",
        statusCode: 401,
        hint: "Sign in again to obtain a valid refresh token.",
        details: getErrorDetail(routeObj),
      });

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

    // cookie
    const { accessToken } = sendCookie({
      res,
      accessTokenName: authConfigObj.accessTokenName!,
      accessTokenPayload: {
        sub: payload.sub,
      },
      routeObj,
    });

    // response
    appResponse({
      res,
      message: "Access token renewed successfully!",
      accessToken: authConfigObj?.returnAccessToken ? accessToken : undefined,
    });
  };
};

export default refresh;
