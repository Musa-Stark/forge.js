import registerModel from "../lib/model.registry.js";
import AppError from "./AppError.js";
import getErrorDetail from "./getErrorDetail.js";
import type { Route } from "../types/Collection.js";

const getModel = ({
  model,
  route,
  routeObj,
}: {
  model: string;
  route?: string;
  routeObj?: Route;
}) => {
  if (!model) {
    throw new AppError({
      message: `Model name is required for routeObj '${route}'`,
      statusCode: 500,
      hint: "Provide a valid model when configuring the collection.",
      details: getErrorDetail(routeObj!),
    });
  }

  const Model = registerModel[model];

  if (!Model) {
    throw new AppError({
      message: `Model '${model}' is not registered`,
      statusCode: 500,
      hint: "Register the model before using it in a collection.",
      details: getErrorDetail(routeObj!),
    });
  }

  return Model;
};

export default getModel;