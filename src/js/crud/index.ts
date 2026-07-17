import type { Express } from "express";
import { getEnvs } from "../config/envs.js";
import asyncHandler from "../utils/AsyncHandler.js";
import handlerMap from "../config/handlerMap.js";
import type { ValidationsObj, Route } from "../types/Collection.ts";
import protect from "../middleware/auth.middleware.js";
import AppError from "../utils/AppError.js";
import { handleMulterMiddleware } from "../middleware/multer.middleware.js";

const crud = (
  app: Express,
  routeName: string,
  routes: Route[],
  modelName: string | undefined,
  validationsObj?: ValidationsObj,
) => {
  const { apiVersion } = getEnvs();
  for (const route of routes) {

    // push middleware to middlewares
    if (!route.authRole)
      throw new AppError({
        message: `authRole is required in REQUEST_TYPE: 'crud', METHOD: '${route.method}', PATH: '${route.path}', HANDLER: '${route.handler}'`,
        statusCode: 409,
      });

    // middlewares array
    const middlewares = [];

    // protect
    if (route.authRole !== "public") middlewares.push(protect);

    // upload in route
    if (route?.uploadArray)
      middlewares.push(handleMulterMiddleware(route.uploadArray));
    
    // app.get("/", (req, res) => {})
    app[route.method](
      `/api/v${apiVersion}/${routeName}${route.path}`,
      ...middlewares,
      asyncHandler(
        // redirect -> handler
        handlerMap[route.handler]({
          modelName,
          routeName,
          route,
          validationsObj,
        }),
      ),
    );
  }
};

export default crud;
