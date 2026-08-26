import AppError from "../../utils/AppError.js";
import getErrorDetail from "../../utils/getErrorDetail.js";
import type { Route } from "../../types/Collection.js";
import { getEnvs } from "../../config/envs.js";
import type { Request } from "express";

const getToken = ({
  req,
  routeObj,
  type,
}: {
  req: Request;
  routeObj: Route;
  type: "accessTokenName" | "refreshTokenName";
}) => {
  const { authConfigObj } = getEnvs();

  const reqMethod = req.method;

  const tokenName = authConfigObj[type];

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
        message: `${type === "accessTokenName" ? "Access" : "Refresh"} token is missing`,
        code: `${type === "accessTokenName" ? "ACCESS" : "REFRESH"}_TOKEN_MISSING`,
        details: getErrorDetail(routeObj),
        hint: `With POST method, '${tokenName}' is required in body as string.`,
        statusCode: 401,
      });

    token = bodyToken;
  }

  // token not found - re-login
  if (!token)
    throw new AppError({
      message: `${type === "accessTokenName" ? "Access" : "Refresh"} token is missing`,
       code: `${type === "accessTokenName" ? "ACCESS" : "REFRESH"}_TOKEN_MISSING`,
      details: getErrorDetail(routeObj),
      hint: type === "accessTokenName" ? "Hit the refresh endpoint to get a new access_token. Default: /auth/refresh-token" :  "Log in again to create a new authentication session.",
      statusCode: 401,
    });

  return token;
};
export default getToken;
