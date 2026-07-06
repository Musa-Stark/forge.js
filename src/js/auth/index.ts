import type { Express } from "express";
import type { Route } from "../types/Collection.ts";
import { getEnvs } from "../config/envs.js";

const auth = (app: Express, routeName: string, routes: Route[]) => {
  const { apiVersion } = getEnvs();

  for (const route of routes) {
    // if (!healthMap[route.handler])
    //   throw new AppError({
    //     message: `${route.handler} not available`,
    //     statusCode: 409,
    //   });

    app[route.method](`/api/v${apiVersion}/${routeName}`, (req, res) => {
      res.json({ success: true, message: "Auth page working" });
    });
  }
};

export default auth;
