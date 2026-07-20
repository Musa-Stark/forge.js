import AppError from "../../utils/AppError.js";
import { verifyHash } from "../../utils/libsodium.js";
import getUser from "./getUser.js";
import type { Route } from "../../types/Collection.js";

const verifyCredentials = async ({
  modelName,
  body,
  routeName,
  route,
}: {
  modelName: string;
  body: any;
  routeName: string;
  route: Route;
}) => {
  if (!modelName || !body)
    throw new AppError({
      message: "modelName and body are required.",
      statusCode: 400,
      code: "MISSING_PARAMETER",
      hint: "Provide modelName and body before verifying credentials.",
      details: {
        handler: route.handler,
        method: route.method,
        path: route.path,
      },
    });

  // user
  const user = await getUser({
    modelName,
    routeName,
    email: body.email as string,
    needPassword: true,
    route
  });

  const isValid = await verifyHash(body.password, user.password, route);

  if (!isValid)
    throw new AppError({
      message: "Invalid password.",
      statusCode: 401,
      code: "AUTH_PASSWORD_INCORRECT",
      hint: "Verify your password and try again.",
      details: {
        handler: route.handler,
        method: route.method,
        path: route.path,
      },
    });
};

export default verifyCredentials;