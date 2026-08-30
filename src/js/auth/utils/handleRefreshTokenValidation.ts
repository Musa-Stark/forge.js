import { verifyHash } from "../../utils/libsodium.js";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.js";
import getModel from "../../utils/getModel.js";
import getErrorDetail from "../../utils/getErrorDetail.js";
import findRefreshToken from "./findRefreshToken.js";

const handleRefreshTokenValidation = async (
  token: string,
  routeObj: Route,
  owner: string,
  jti: string,
) => {
  // Model
  const RefreshToken = getModel({ modelName: "RefreshToken", routeObj });

  // find same device tokens
  const foundToken = await findRefreshToken(owner, jti, routeObj);

  // if token not found
  if (!foundToken)
    throw new AppError({
      message: "Refresh token is not found.",
      code: "REFRESH_NO_LONGER_EXISTS",
      statusCode: 404,
      hint: "This refresh token is deleted. Sign in again to create a new authentication session.",
      details: getErrorDetail(routeObj),
    });

  // token hash verification
  const isValid = await verifyHash(
    token,
    foundToken.refreshTokenHash,
    routeObj,
  );

  // if token is revoked
  if (foundToken.revoked)
    throw new AppError({
      message: "Refresh token black listed.",
      code: "REFRESH_TOKEN_INVALID",
      statusCode: 404,
      hint: "This refresh token can't be used. Sign in again to create a new authentication session.",
      details: getErrorDetail(routeObj),
    });

  // if invalid hash
  if (!isValid) {
    await RefreshToken.updateOne(
      {
        owner,
        jti,
        revoked: false,
      },
      { $set: { revoked: true } },
    );

    throw new AppError({
      message: "Refresh token is invalid",
      code: "REFRESH_TOKEN_INVALID",
      statusCode: 401,
      hint: "Sign in again to create a new authentication session.",
      details: getErrorDetail(routeObj),
    });
  }

  return token;
};
export default handleRefreshTokenValidation;
