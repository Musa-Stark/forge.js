import type { Response } from "express";
import getDuration from "../../config/duration.js";
import { getEnvs } from "../../config/envs.js";
import AppError from "../../utils/AppError.js";
import { signJWT } from "../../utils/handleJWT.js";
import type { Route } from "../../types/Collection.js";

export const sendCookie = ({
  res,
  cookieName,
  payload,
  routeObj,
}: {
  res: Response;
  cookieName: string;
  payload: string | object;
  routeObj: Route;
}) => {
  const { tokenExpiry, ENV, domain } = getEnvs();

  if (!tokenExpiry || !ENV)
    throw new AppError({
      message: "tokenExpiry and ENV are required.",
      statusCode: 500,
      code: "MISSING_ENVIRONMENT_VARIABLE",
      hint: "Define tokenExpiry and ENV in your environment configuration.",
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
      code: "MISSING_ENVIRONMENT_VARIABLE",
      hint: "Define domain when ENV is set to production.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  const token = signJWT({ payload, routeObj });

  res.cookie(cookieName, token, {
    httpOnly: true,
    maxAge: getDuration(tokenExpiry, routeObj),
    sameSite: ENV === "production" ? "none" : "lax",
    secure: ENV === "production",
    domain: ENV === "production" ? domain : undefined,
  });
};

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
      code: "MISSING_ENVIRONMENT_VARIABLE",
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
      code: "MISSING_ENVIRONMENT_VARIABLE",
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