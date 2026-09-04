import getModel from "../../utils/getModel.js";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.js";
import { getEnvs } from "../../config/envs.js";

const getUser = async ({
  model,
  route,
  email,
  needPassword,
  routeObj,
}: {
  model: string;
  route: string;
  email: string;
  needPassword?: boolean;
  routeObj: Route;
}) => {
  // get dynamic auth field keys
  const { authConfigObj } = getEnvs();
  const { fieldsObj } = authConfigObj;

  const emailKey = fieldsObj?.email;
  const passwordKey = fieldsObj?.password;

  // model
  const Model = getModel({ model, route, routeObj });

  // user
  let user: any = null;

  if (needPassword) {
    user = await Model.findOne({
      [emailKey!]: email,
    }).select(`+${passwordKey!}`);
  } else {
    user = await Model.findOne({
      [emailKey!]: email,
    });
  }

  // if user not found
  if (!user)
    throw new AppError({
      message: "User not found.",
      statusCode: 404,
      hint: `Verify the provided ${emailKey} or create a new account.`,
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  return user;
};

export default getUser;