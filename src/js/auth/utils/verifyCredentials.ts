import registerModel from "../../lib/model.registry.js";
import AppError from "../../utils/AppError.js";
import { verifyHash } from "../../utils/libsodium.js";
import getModel from "../../utils/getModel.js";
import getUser from "./getUser.js";

const verifyCredentials = async ({
  modelName,
  body,
  routeName,
}: {
  modelName: string;
  body: any;
  routeName: string;
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

  const isValid = await verifyHash(body.password, user.password);
  if (!isValid)
    throw new AppError({ message: "Invalid password", statusCode: 409 });
};

export default verifyCredentials;
