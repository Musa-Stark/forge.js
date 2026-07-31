import getModel from "../../utils/getModel.js";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.js";

const getUser = async ({
  modelName,
  routeName,
  email,
  needPassword,
  routeObj,
}: {
  modelName: string;
  routeName: string;
  email: string;
  needPassword?: boolean;
  routeObj: Route;
}) => {
  // model
  const Model = getModel({ modelName, routeName, routeObj });

  // user
  let user: any = null;

  if (needPassword) {
    user = await Model.findOne({ email }).select("+password");
  } else {
    user = await Model.findOne({ email });
  }

  // if user not found
  if (!user)
    throw new AppError({
      message: "User not found.",
      statusCode: 404,
      code: "AUTH_USER_NOT_FOUND",
      hint: "Verify the provided email address or create a new account.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  return user;
};

export default getUser;