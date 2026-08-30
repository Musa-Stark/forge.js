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

  const tokenName = authConfigObj[type];

  let token = req.cookies[tokenName!];
  if (!token) token = req.body[tokenName!];

  if (!token || typeof token !== "string")
    throw new AppError({
      message: `'${tokenName}' is missing`,
      code: `${type === "accessTokenName" ? "ACCESS" : "REFRESH"}_TOKEN_MISSING`,
      details: getErrorDetail(routeObj),
      hint: `If frontend is in browser, make sure you have '${tokenName}' in console cookies section and 'credentials: include' in request options. If frontend is in mobile device, make sure to include in cookie req.body with 'POST' method.`,
      statusCode: 401,
    });

  return token;
};
export default getToken;
