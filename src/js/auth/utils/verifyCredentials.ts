import registerModel from "../../lib/model.registry.js";
import AppError from "../../utils/AppError.js";
import { verifyHash } from "../../utils/libsodium.js";
import getModel from "./getModel.js";

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

  const Model = getModel({ modelName, routeName });

  const user = await Model.findOne({ email: body.email }).select("+password");
  if (!user)
    throw new AppError({ message: "User not found.", statusCode: 404 });

  const isValid = await verifyHash(body.password, user.password);
  if (!isValid)
    throw new AppError({ message: "Invalid password", statusCode: 409 });
};

export default verifyCredentials;
