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
  for (const route of routes) {
    // push middleware to middlewares
    if (
      !route.authRole ||
      !route.handler ||
      !route.method ||
      !route.path
    )
      throw new AppError({
        message: "authRole, handler, method and path are required required",
        statusCode: 409,
        code: "CRUD_AUTHROLE_NOT_FOUND",
        hint: "Check if authRole, handler, method or path is missing in collections -> routes.",
        details: getErrorDetail(route),
      });

    // middlewares array
    const middlewares = [];

    // protect
    if (route.authRole !== "public") middlewares.push(protect(route));

    // upload in route
    if (route?.fileArray)
      middlewares.push(handleMulterMiddleware(route.fileArray, route));

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
