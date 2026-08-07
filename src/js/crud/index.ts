import type { Express } from "express";
import { getEnvs } from "../config/envs.js";
import asyncHandler from "../utils/AsyncHandler.js";
import handlerMap from "../config/handlerMap.js";
import type { ValidationsObj, Route } from "../types/Collection.ts";
import protect from "../middleware/auth.middleware.js";
import AppError from "../utils/AppError.js";
import { handleMulterMiddleware } from "../middleware/multer.middleware.js";
import getErrorDetail from "../utils/getErrorDetail.js";

const crud = (
  app: Express,
  routeName: string,
  routes: Route[],
  modelName: string | undefined,
  validationsObj?: ValidationsObj,
) => {
  const { apiVersion } = getEnvs();
  for (const routeObj of routes) {
    // push middleware to middlewares
    if (
      !routeObj.authRole ||
      !routeObj.handler ||
      !routeObj.method ||
      !routeObj.path
    )
      throw new AppError({
        message: "authRole, handler, method and path are required required",
        statusCode: 409,
        hint: "Check if authRole, handler, method or path is missing in collections -> routes.",
        details: getErrorDetail(routeObj),
      });

    // middlewares array
    const middlewares = [];

    // protect
    if (routeObj.authRole !== "public") middlewares.push(protect(routeObj));

    // upload in routeObj
    if (routeObj?.fileArray)
      middlewares.push(handleMulterMiddleware(routeObj.fileArray, routeObj));

    // app.get("/", (req, res) => {})
    app[routeObj.method](
      `/api/v${apiVersion}/${routeName}${routeObj.path}`,
      ...middlewares,
      asyncHandler(
        // redirect -> handler
        handlerMap[routeObj.handler]({
          modelName,
          routeName,
          routeObj,
          validationsObj,
        }),
      ),
    );
  }
};

export default crud;
