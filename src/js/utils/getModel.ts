import registerModel from "../lib/model.registry.js";
import AppError from "./AppError.js";
import getErrorDetail from "./getErrorDetail.js";
import type { Route } from "../types/Collection.js";

const getModel = ({
  modelName,
  routeName,
  route,
}: {
  modelName: string;
  routeName: string;
  route: Route;
}) => {
  if (!modelName) {
    throw new AppError({
      message: `Model name is required for route '${routeName}'`,
      statusCode: 500,
      code: "MODEL_NAME_REQUIRED",
      hint: "Provide a valid modelName when configuring the collection.",
      details: getErrorDetail(route),
    });
  }

  const Model = registerModel[modelName];

  if (!Model) {
    throw new AppError({
      message: `Model '${modelName}' is not registered`,
      statusCode: 500,
      code: "MODEL_NOT_REGISTERED",
      hint: "Register the model before using it in a collection.",
      details: getErrorDetail(route),
    });
  }

  return Model;
};

export default getModel;