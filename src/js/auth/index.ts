import type { Express } from "express";
import type { Route, ValidationsObj } from "../types/Collection.ts";
import { getEnvs } from "../config/envs.js";
import asyncHandler from "../utils/AsyncHandler.js";
import handlerMap from "../lib/handlerMap.js";
import type { OTPSchema } from "../types/MongooseOTPSchemaObj.js";
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
  mongooseSchemaObj?: OTPSchema,
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

  for (const route of routes) {
    // auth.middleware.ts
    const middleware = [];
    if (route.path === "/logout") middleware.push(protect);

    app[route.method](
      // /api/v1/auth/signup
      `/api/v${apiVersion}/${routeName}${route.path}`,
      ...middleware,
      asyncHandler(
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

export default auth;
