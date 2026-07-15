import type { Express } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import { getEnvs } from "../config/envs.js";
import handlerMap from "../lib/handlerMap.js";

const health = (
  app: Express,
  routeName: string,
  routes: Route[],
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
