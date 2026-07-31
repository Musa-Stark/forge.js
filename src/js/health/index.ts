import type { Express } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import { getEnvs } from "../config/envs.js";
import handlerMap from "../config/handlerMap.js";

const health = (
  app: Express,
  routeName: string,
  routes: Route[],
) => {
  const { apiVersion } = getEnvs();

  for (const routeObj of routes) {
    app[routeObj.method](
      `/api/v${apiVersion}/${routeName}${routeObj.path}`,
      handlerMap[routeObj.handler],
    );
  }
};

export default health;
