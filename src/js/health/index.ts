import type { Express } from "express";
import type { Route } from "../types/Collection.ts";
import { getEnvs } from "../config/envs.js";
import handlerMap from "../lib/handlerMap.js";
import type { ValidationsObj } from "../types/ValidationsObj.js";

const health = (
  app: Express,
  routeName: string,
  routes: Route[],
  modelName: string | undefined,
  validationsObj?: ValidationsObj | undefined
) => {
  const { apiVersion } = getEnvs();

  for (const route of routes) {
    app[route.method](
      `/api/v${apiVersion}/${routeName}`,
      handlerMap[route.handler],
    );
  }
};

export default health;
