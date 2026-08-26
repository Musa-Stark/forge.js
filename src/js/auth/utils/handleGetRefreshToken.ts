import AppError from "../../utils/AppError.js";
import getErrorDetail from "../../utils/getErrorDetail.js";
import type { Route } from "../../types/Collection.js";
import { getEnvs } from "../../config/envs.js";
import type { Request } from "express";

const getRefreshToken = ({
  req,
  reqMethod,
  routeObj,
}: {
  req: Request;
  reqMethod: string;
  routeObj: Route;
}) => {
  const { authConfigObj } = getEnvs();

  const tokenName = authConfigObj.refreshTokenName;

  // if method isn't get or post
  if (reqMethod !== "GET" && reqMethod !== "POST")
    throw new AppError({
      details: getErrorDetail(routeObj),
      hint: "This is route only works with GET and POST methods",
      message: "Invalid method",
      statusCode: 409,
      code: "INVALID_REFRESH_TOKEN_METHOD",
    });

  let token = null;

  if (reqMethod === "GET") {
    token = req.cookies[tokenName!];
  } else {
    const bodyToken = req.body[tokenName!];

    if (!bodyToken || typeof bodyToken !== "string")
      throw new AppError({
        message: "Refresh token is missing",
        code: "REFRESH_TOKEN_MISSING",
        details: getErrorDetail(routeObj),
        hint: `With POST method, '${tokenName}' is required in body as string.`,
        statusCode: 401,
      });

    token = bodyToken;
  }

  // token not found - re-login
  if (!token)
    throw new AppError({
      message: "Refresh token is missing",
      code: "REFRESH_TOKEN_MISSING",
      details: getErrorDetail(routeObj),
      hint: "Log in again to create a new authentication session.",
      statusCode: 401,
    });

  return token;
};
export default getRefreshToken;
