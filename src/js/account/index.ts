import type { Express } from "express";
import { getEnvs } from "../config/envs.js";
import asyncHandler from "../utils/AsyncHandler.js";
import handlerMap from "../config/handlerMap.js";
import type { ValidationsObj, Route } from "../types/Collection.ts";
import protect from "../middleware/auth.middleware.js";
import AppError from "../utils/AppError.js";
import { handleMulterMiddleware } from "../middleware/multer.middleware.js";
import getErrorDetail from "../utils/getErrorDetail.js";

const account = (
  app: Express,
  route: string,
  routes: Route[],
  model: string | undefined,
  validations?: ValidationsObj,
) => {
  const { apiVersion } = getEnvs();
  for (const routeObj of routes) {

    // push middleware to middlewares
    if (!routeObj.handler || !routeObj.method || !routeObj.path)
      throw new AppError({
        message: "handler, method and path are required required",
        statusCode: 409,
        hint: "Check if handler, method or path is missing in collections -> routes.",
        details: getErrorDetail(routeObj),
      });

    // middlewares array
    const middlewares = [];

    // protect
    middlewares.push(protect(routeObj));

    // upload in routeObj
    if (routeObj?.files)
      middlewares.push(handleMulterMiddleware(routeObj.files, routeObj));

    // app.get("/", (req, res) => {})
    app[routeObj.method](
      `/api/v${apiVersion}/${route}${routeObj.path}`,
      ...middlewares,
      asyncHandler(
        // redirect -> handler
        handlerMap[routeObj.handler]({
          model,
          route,
          routeObj,
          validations,
        }),
      ),
    );
  }
};

export default account;
