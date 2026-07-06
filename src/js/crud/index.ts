import type { Express } from "express";
import type { Route } from "../types/Collection.ts";
import { getEnvs } from "../config/envs.js";

const health = (app: Express, routeName: string, routes: Route[]) => {
  const { apiVersion } = getEnvs();

  for (const route of routes) {
    app[route.method](`/api/v${apiVersion}/${routeName}`, (req, res) => {
      res.json({
        success: true,
        message: `Route: '${routeName}' - Method: '${route.method}' working...`,
      });
    });
  }
};

export default health;
