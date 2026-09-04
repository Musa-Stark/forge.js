import AppError from "../../utils/AppError.js";
import { verifyHash } from "../../utils/libsodium.js";
import getUser from "./getUser.js";
import type { Route } from "../../types/Collection.js";
import { getEnvs } from "../../config/envs.js";

const verifyCredentials = async ({
  model,
  body,
  route,
  routeObj,
}: {
  model: string;
  body: any;
  route: string;
  routeObj: Route;
}) => {
  // get dynamic auth field keys
  const { authConfigObj } = getEnvs();
  const { fieldsObj } = authConfigObj;

  const emailKey = fieldsObj?.email;
  const passwordKey = fieldsObj?.password;

  if (!model || !body)
    throw new AppError({
      message: "model and body are required.",
      statusCode: 400,
      hint: "Provide model and body before verifying credentials.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  // user
  const user = await getUser({
    model,
    route,
    email: body[emailKey!] as string,
    needPassword: true,
    routeObj,
  });

  const isValid = await verifyHash(
    body[passwordKey!],
    user[passwordKey!],
    routeObj
  );

  if (!isValid)
    throw new AppError({
      message: "Invalid password.",
      statusCode: 401,
      hint: `Verify your ${passwordKey} and try again.`,
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });
};

export default verifyCredentials;