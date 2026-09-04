import health from "../health/index.js";
import auth from "../auth/index.js";
import crud from "../crud/index.js";
import account from "../account/index.js";
import type { Express } from "express";
import type { ReqType } from "../types/Collection.ts";
import type { Route } from "../types/Collection.ts";
import type { MongooseSchema, ValidationsObj } from "../types/Collection.ts";

const reqMap = {
  health,
  auth,
  crud,
  account
};

const handleReqType = (
  type: ReqType,
  app: Express,
  route: string,
  routes: Route[],
  model: string | undefined,
  validations?: ValidationsObj,
  schema?: MongooseSchema,
) => {
  
  if (!type) return;

  // health(app, health, [{...}])
  reqMap[type](
    app,
    route,
    routes,
    model,
    validations,
    schema,
  );
};

export default handleReqType;
