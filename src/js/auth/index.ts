import type { Express } from "express";
import type {
  Route,
  ValidationsObj,
  MongooseSchema,
} from "../types/Collection.ts";
import { getEnvs } from "../config/envs.js";
import asyncHandler from "../utils/AsyncHandler.js";
import handlerMap from "../config/handlerMap.js";
import registerModel from "../lib/model.registry.js";
import createOTPModel from "./utils/createOTPModel.js";
import { envs } from "../config/envs.js";
import protect from "../middleware/auth.middleware.js";

const auth = (
  app: Express,
  routeName: string,
  routes: Route[],
  modelName: string | undefined,
  validationsObj?: ValidationsObj,
  mongooseSchemaObj?: MongooseSchema,
) => {
  const { apiVersion } = getEnvs();

  // set userModelName in envs
  envs.userModelName = modelName as string;

  // === create otp model ===
  // const otpRoute = routes.some((r) => r.mode === "otp");
  // if (otpRoute) {
  const otpUserModel = createOTPModel(routeName, mongooseSchemaObj!);
  registerModel["otpUser"] = otpUserModel;
  // }

  for (const routeObj of routes) {
    // auth.middleware.ts
    const middleware = [];
    if (routeObj.path === "/logout") middleware.push(protect(routeObj));

    app[routeObj.method](
      // /api/v1/auth/signup
      `/api/v${apiVersion}/${routeName}${routeObj.path}`,
      ...middleware,
      asyncHandler(
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

export default auth;
