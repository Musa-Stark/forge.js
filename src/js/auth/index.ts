import type { Express } from "express";
import type { Route } from "../types/Collection.ts";
import { getEnvs } from "../config/envs.js";
import type { ValidationsObj } from "../types/ValidationsObj.js";
import asyncHandler from "../utils/AsyncHandler.js";
import handlerMap from "../lib/handlerMap.js";
import type { OTPSchema } from "../types/MongooseOTPSchemaObj.js";
import registerModel from "../lib/model.registry.js";
import createOTPModel from "./utils/createOTPModel.js";

const auth = (
  app: Express,
  routeName: string,
  routes: Route[],
  modelName: string | undefined,
  validationsObj?: ValidationsObj,
  mongooseSchemaObj?: OTPSchema,
) => {
  const { apiVersion } = getEnvs();

  // === create otp model ===
  // const otpRoute = routes.some((r) => r.mode === "otp");
  // if (otpRoute) {
  const otpUserModel = createOTPModel(routeName, mongooseSchemaObj!);
  registerModel["otpUser"] = otpUserModel;
  // }

  for (const route of routes) {
    app[route.method](
      // /api/v1/auth/signup
      `/api/v${apiVersion}/${routeName}${route.path}`,
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
