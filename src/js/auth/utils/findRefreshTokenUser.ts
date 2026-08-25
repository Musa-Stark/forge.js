import { findUser } from "../../middleware/auth.middleware.js";
import type { Route } from "../../types/Collection.js";
import { getEnvs } from "../../config/envs.js";
import AppError from "../../utils/AppError.js";
import getErrorDetail from "../../utils/getErrorDetail.js";

const findRefreshTokenUser = async (id: string, routeObj: Route) => {
  const { userModelName } = getEnvs();

  const user = await findUser(id, routeObj, userModelName as string);

  // if user not found
  if (!user)
    throw new AppError({
      message: "User associated with the refresh token was not found",
      code: "REFRESH_USER_NOT_FOUND",
      statusCode: 401,
      hint: "Sign in again with an existing account.",
      details: getErrorDetail(routeObj),
    });
};
export default findRefreshTokenUser;
