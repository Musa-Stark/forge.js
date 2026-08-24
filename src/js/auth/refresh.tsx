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
    // refreshToken
    const token = req.cookies.refresh_token;

    // token not found - re-login
    if (!token)
      throw new AppError({
        message: "Token not found - re-login",
        details: getErrorDetail(routeObj),
        hint: "Re-login",
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
        message: "Invalid JWT payload - re-login",
        statusCode: 401,
        hint: "Sign in again to obtain a valid token.",
        details: getErrorDetail(routeObj),
      });

    // find user
    const user = await findUser(payload.sub as string, routeObj);

    // if user not found
    if (!user)
      new AppError({
        message: "This account no longer exists",
        statusCode: 401,
        hint: "Sign in with an existing account or create new one.",
        details: getErrorDetail(routeObj),
      });

    // cookie
    const { accessToken } = sendCookie({
      res,
      accessTokenName: "access_token",
      accessTokenPayload: {
        sub: payload.sub,
      },
      routeObj,
    });

    // authConfigObj
    const { authConfigObj } = getEnvs();

    // response
    appResponse({
      res,
      message: "Access token renewed successfully!",
      accessToken: authConfigObj?.returnAccessToken ? accessToken : undefined,
    });
  };
};

export default refresh;
