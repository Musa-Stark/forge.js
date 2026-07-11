import registerModel from "../../lib/model.registry.js";
import AppError from "../../utils/AppError.js";

const getModel = ({
  modelName,
  routeName,
}: {
  modelName: string;
  routeName: string;
}) => {
  if (!modelName)
    throw new AppError({
      message: `modelName for ${routeName} route is required`,
      statusCode: 404,
    });

  const Model = registerModel[modelName];
  if (!Model)
    throw new AppError({
      message: `Model: ${modelName} not found to find user`,
      statusCode: 404,
    });

  return Model;
};

export default getModel;
