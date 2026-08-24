import registerModel from "../lib/model.registry.js";
import AppError from "./AppError.js";
import getErrorDetail from "./getErrorDetail.js";
import type { Route } from "../types/Collection.js";

const getModel = ({
  modelName,
  routeName,
  routeObj,
}: {
  modelName: string;
  routeName?: string;
  routeObj?: Route;
}) => {
  if (!modelName) {
    throw new AppError({
      message: `Model name is required for routeObj '${routeName}'`,
      statusCode: 500,
      hint: "Provide a valid modelName when configuring the collection.",
      details: getErrorDetail(routeObj!),
    });
  }

  const Model = registerModel[modelName];

  if (!Model) {
    throw new AppError({
      message: `Model '${modelName}' is not registered`,
      statusCode: 500,
      hint: "Register the model before using it in a collection.",
      details: getErrorDetail(routeObj!),
    });
  }

  return Model;
};

export default getModel;