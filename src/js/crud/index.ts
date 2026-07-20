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
        message: "authRole is required",
        statusCode: 409,
        code: "CRUD_AUTHROLE_NOT_FOUND",
        hint: "Write authRole in collections -> routes -> authRole. Make it public if this route doesn't need authentication or authorization",
        details: {
          handler: route.handler,
          method: route.method,
          path: route.path,
        },
      });

    // middlewares array
    const middlewares = [];

    // protect
    if (route.authRole !== "public") middlewares.push(protect(route));

    // upload in route
    if (route?.fileArray)
      middlewares.push(handleMulterMiddleware(route.fileArray));

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
