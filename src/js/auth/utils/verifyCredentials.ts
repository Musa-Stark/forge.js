import AppError from "../../utils/AppError.js";
import { verifyHash } from "../../utils/libsodium.js";
import getUser from "./getUser.js";
import type { Route } from "../../types/Collection.js";

const verifyCredentials = async ({
  modelName,
  body,
  routeName,
  routeObj,
}: {
  modelName: string;
  body: any;
  routeName: string;
  routeObj: Route;
}) => {
  if (!modelName || !body)
    throw new AppError({
      message: "modelName and body are required.",
      statusCode: 400,
      code: "MISSING_PARAMETER",
      hint: "Provide modelName and body before verifying credentials.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  // user
  const user = await getUser({
    modelName,
    routeName,
    email: body.email as string,
    needPassword: true,
    routeObj
  });

  const isValid = await verifyHash(body.password, user.password, routeObj);

  if (!isValid)
    throw new AppError({
      message: "Invalid password.",
      statusCode: 401,
      code: "AUTH_PASSWORD_INCORRECT",
      hint: "Verify your password and try again.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });
};

export default verifyCredentials;