import type { Response } from "express";
import getDuration from "../../config/duration.js";
import { getEnvs } from "../../config/envs.js";
import AppError from "../../utils/AppError.js";
import { signJWT } from "../../utils/handleJWT.js";
import type { Route } from "../../types/Collection.js";

// send cookie
export const sendCookie = ({
  res,
  accessTokenName,
  accessTokenPayload,
  refreshTokenName,
  refreshTokenPayload,
  routeObj,
}: {
  res: Response;
  accessTokenName: string;
  accessTokenPayload: string | object;
  refreshTokenName?: string;
  refreshTokenPayload?: string | object;
  routeObj: Route;
}) => {
  const { ENV, domain, authConfigObj } = getEnvs();

  const { accessTokenAge, refreshTokenAge } = authConfigObj;

  if (ENV === "production" && !domain)
    throw new AppError({
      message: "domain is required in production.",
      statusCode: 500,
      hint: "Define domain when ENV is set to production.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  const accessToken = signJWT({
    payload: accessTokenPayload,
    routeObj,
    age: accessTokenAge!,
  });

  // if refreshToken to send
  let refreshToken = null;
  if (refreshTokenName)
    refreshToken = signJWT({
      payload: refreshTokenPayload!,
      routeObj,
      age: refreshTokenAge!,
    });

  res.cookie(accessTokenName, accessToken, {
    httpOnly: true,
    maxAge: getDuration(accessTokenAge!, routeObj),
    sameSite: ENV === "production" ? "none" : "lax",
    secure: ENV === "production",
    domain: ENV === "production" ? domain : undefined,
  });

  // if refreshToken to send
  if (refreshToken)
    res.cookie(refreshTokenName!, refreshToken, {
      httpOnly: true,
      maxAge: getDuration(refreshTokenAge!, routeObj),
      sameSite: ENV === "production" ? "none" : "lax",
      secure: ENV === "production",
      domain: ENV === "production" ? domain : undefined,
    });

  return { accessToken, refreshToken, refreshTokenAge };
};

// clear cookie
export const clearCookie = ({
  res,
  cookieName,
  routeObj,
}: {
  res: Response;
  cookieName: string;
  routeObj: Route;
}) => {
  const { ENV, domain } = getEnvs();

  if (!ENV)
    throw new AppError({
      message: "ENV is required.",
      statusCode: 500,
      hint: "Define ENV in your environment configuration.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  if (ENV === "production" && !domain)
    throw new AppError({
      message: "domain is required in production.",
      statusCode: 500,
      hint: "Define domain when ENV is set to production.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  res.clearCookie(cookieName, {
    httpOnly: true,
    sameSite: ENV === "production" ? "none" : "lax",
    secure: ENV === "production",
    domain: ENV === "production" ? domain : undefined,
  });
};
