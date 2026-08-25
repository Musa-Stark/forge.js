import { verifyHash } from "../../utils/libsodium.js";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.js";
import getModel from "../../utils/getModel.js";
import getErrorDetail from "../../utils/getErrorDetail.js";

const handleRefreshTokenValidation = async (
  token: string,
  hash: string,
  routeObj: Route,
  owner: string,
  jti: string
) => {
  // Model
  const RefreshToken = getModel({ modelName: "RefreshToken", routeObj });

  const isValid = await verifyHash(token, hash, routeObj);
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
};
export default handleRefreshTokenValidation;
