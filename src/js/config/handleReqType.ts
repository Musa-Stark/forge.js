import health from "../health/index.js";
import auth from "../auth/index.js";
import crud from "../crud/index.js";
import type { Express } from "express";
import type { ReqType } from "../types/Collection.ts";
import type { Route } from "../types/Collection.ts";
import type { MongooseSchema, ValidationsObj } from "../types/Collection.ts";

const reqMap = {
  health,
  auth,
  crud,
};

const handleReqType = (
  reqType: ReqType,
  app: Express,
  routeName: string,
  routes: Route[],
  modelName: string | undefined,
  validationsObj?: ValidationsObj,
  mongooseSchemaObj?: MongooseSchema,
) => {
  
  if (!reqType) return;

  // health(app, health, [{...}])
  reqMap[reqType](
    app,
    routeName,
    routes,
    modelName,
    validationsObj,
    mongooseSchemaObj,
  );
};

export default handleReqType;
