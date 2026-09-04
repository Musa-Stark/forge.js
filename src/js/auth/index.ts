import type { Express } from "express";
import type {
  Route,
  ValidationsObj,
  MongooseSchema,
} from "../types/Collection.ts";
import { getEnvs, envs } from "../config/envs.js";
import asyncHandler from "../utils/AsyncHandler.js";
import handlerMap from "../config/handlerMap.js";
import registerModel from "../lib/model.registry.js";
import createOTPModel from "./utils/createOTPModel.js";
import protect from "../middleware/auth.middleware.js";
import getValidationsObj from "./builtin/getValidations.js";

const auth = (
  app: Express,
  route: string,
  routes: Route[],
  model: string | undefined,
  validations?: ValidationsObj,
  schema?: MongooseSchema,
) => {
  const { apiVersion, authConfigObj } = getEnvs();
  let builtInValidation = null;
  if (authConfigObj?.mode === "builtin") {
    builtInValidation = getValidationsObj(authConfigObj?.schemaObj?.schema!);
    routes = routes.map((item: Route) =>
      item.handler === "login"
        ? { ...item, mode: authConfigObj!.loginMode! }
        : item.handler === "signup"
          ? { ...item, mode: authConfigObj!.signupMode! }
          : item,
    );
  }

  // set userModelName in envs
  envs.userModelName = model as string;

  if (!schema)
    throw new Error(
      "User model schema should also be written in auth collection",
    );

  // === create otp model ===
  // const otpRoute = routes.some((r) => r.mode === "otp");
  // if (otpRoute) {
  const otpUserModel = createOTPModel(route, schema!);
  registerModel["otpUser"] = otpUserModel;
  // }

  for (const routeObj of routes) {
    // auth.middleware.ts
    const middleware = [];
    if (routeObj.path === "/logout") middleware.push(protect(routeObj));

    app[routeObj.method](
      // /api/v1/auth/signup
      `/api/v${apiVersion}/${route}${routeObj.path}`,
      ...middleware,
      asyncHandler(
        handlerMap[routeObj.handler]({
          model,
          route,
          routeObj,
          validations: builtInValidation || validations,
        }),
      ),
    );
  }
};

export default auth;
