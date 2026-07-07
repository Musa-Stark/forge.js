import health from "../health/index.js";
import auth from "../auth/index.js";
import type { Express } from "express";
import type { ReqType } from "../types/Collection.ts";
import type { Route } from "../types/Collection.ts";
import type { ValidationsObj } from "../types/ValidationsObj.js";
import type { OTPSchema } from "../types/MongooseOTPSchemaObj.js";

const reqMap = {
  health,
  auth
};

const handleReqType = (
  reqType: ReqType,
  app: Express,
  routeName: string,
  routes: Route[],
  modelName: string | undefined,
  validationsObj?: ValidationsObj,
  mongooseSchemaObj? : OTPSchema,
) => {
  // health(app, health, [{...}])
  reqMap[reqType](app, routeName, routes, modelName, validationsObj, mongooseSchemaObj);
};

export default handleReqType;
