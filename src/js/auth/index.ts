import type { Express } from "express";
import type { Route } from "../types/Collection.ts";
import { getEnvs } from "../config/envs.js";
import type { ValidationsObj } from "../types/ValidationsObj.js";
import asyncHandler from "../utils/AsyncHandler.js";
import signup from "./signup.js";

const auth = (
  app: Express,
  routeName: string,
  routes: Route[],
  modelName: string | undefined,
  validationsObj?: ValidationsObj,
) => {
  const { apiVersion } = getEnvs();

  for (const route of routes) {
    app[route.method](
      // /api/v1/auth/signup
      `/api/v${apiVersion}/${routeName}${route.path}`,
      asyncHandler(signup(modelName!, validationsObj)),
    );
  }
};

export default auth;
