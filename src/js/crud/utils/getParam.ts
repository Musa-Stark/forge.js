import type { Request } from "express";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.js";

const getParam = ({
  req,
  route,
}: {
  req: Request;
  route: Route;
}) => {
  const key: string = Object.keys(req.params)[0]!;

  if (!key)
    throw new AppError({
      message: "path: '/:[param]' is required",
      statusCode: 409,
      code: "FRAMEWORK_CONFIGURATION_INVALID",
      hint: "Provide path, check collection -> routes -> path configuration or your URL",
      details: {
        handler: route.handler,
        method: route.method,
        path: route.path
      }
    });

  return req.params[key];
};

export default getParam;
