import getModel from "../../utils/getModel.js";
import AppError from "../../utils/AppError.js";

const getUser = async ({
  modelName,
  routeName,
  email,
  needPassword,
}: {
  modelName: string;
  routeName: string;
  email: string;
  needPassword?: boolean;
}) => {
  // model
  const Model = getModel({ modelName, routeName });

  // user
  let user: any = null;
  if (needPassword) {
    user = await Model.findOne({ email }).select("+password");
  } else {
    user = await Model.findOne({ email });
  }

  // if user not found
  if (!user)
    throw new AppError({ message: "User not found.", statusCode: 404 });

  return user;
};

export default getUser;
