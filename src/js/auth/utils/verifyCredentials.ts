import AppError from "../../utils/AppError.js";
import { verifyHash } from "../../utils/libsodium.js";
import getUser from "./getUser.js";
import type { Route } from "../../types/Collection.js";

const verifyCredentials = async ({
  modelName,
  body,
  routeName,
  route
}: {
  modelName: string;
  body: any;
  routeName: string;
  route: Route
}) => {
  if (!modelName || !body)
    throw new AppError({
      message: "modelName and body are required to verify credentials",
      statusCode: 409,
    });

  // user
  const user = await getUser({
    modelName,
    routeName,
    email: body.email as string,
    needPassword: true,
  });

  const isValid = await verifyHash(body.password, user.password, route);
  if (!isValid)
    throw new AppError({ message: "Invalid password", statusCode: 409 });
};

export default verifyCredentials;
