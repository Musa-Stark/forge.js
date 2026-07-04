import type { Express } from "express";
import type { Route } from "../types/Collection.ts";
import { getEnvs } from "../config/envs.js";
import asyncHandler from "../utils/AsyncHandler.js";
import {
  healthGet,
  healthPost,
  healthPut,
  healthPatch,
  healthDelete,
} from "./bunch.health.js";
import AppError from "../utils/AppError.js";

const healthMap = {
  healthGet,
  healthPost,
  healthPut,
  healthPatch,
  healthDelete,
};

const health = (app: Express, routeName: string, routes: Route[]) => {
  const { apiVersion } = getEnvs();

  for (const route of routes) {
    if (!healthMap[route.handler])
      throw new AppError({
        message: `${route.handler} not available`,
        statusCode: 409,
      });

    app[route.method](
      `/api/v${apiVersion}/${routeName}`,
      healthMap[route.handler],
    );
  }
};

export default health;
