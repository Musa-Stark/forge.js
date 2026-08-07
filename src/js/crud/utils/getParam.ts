import type { Request } from "express";
import AppError from "../../utils/AppError.js";
import type { Route } from "../../types/Collection.js";

const getParam = ({
  req,
  routeObj,
}: {
  req: Request;
  routeObj: Route;
}) => {
  const key: string = Object.keys(req.params)[0]!;

  if (!key)
    throw new AppError({
      message: "path: '/:[param]' is required",
      statusCode: 409,
      hint: "Provide path, check collection -> routes -> path configuration or your URL",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path
      }
    });

  return req.params[key];
};

export default getParam;
