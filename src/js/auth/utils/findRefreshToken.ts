import type { Route } from "../../types/Collection.js";
import getModel from "../../utils/getModel.js";
import AppError from "../../utils/AppError.js";
import getErrorDetail from "../../utils/getErrorDetail.js";

const findRefreshToken = async (
  owner: string,
  jti: string,
  routeObj: Route,
) => {
  // Model
  const RefreshToken = getModel({ modelName: "RefreshToken", routeObj });

  // find same device tokens
  const foundRefreshToken = await RefreshToken.findOne({
    owner,
    jti,
  });

  // token not found
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

  return foundRefreshToken;
};
export default findRefreshToken;
