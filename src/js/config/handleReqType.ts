import health from "../health/index.js";
import crud from "../crud/index.js";
import auth from "../auth/index.js";
import type { Express } from "express";
import type { ReqType } from "../types/Collection.ts";
import type { Route } from "../types/Collection.ts";

const reqMap = {
  health,
  crud,
  auth,
};

const handleReqType = (
  reqType: ReqType,
  app: Express,
  routeName: string,
  routes: Route[],
) => {
  // health(app, health, [{...}])
  reqMap[reqType](app, routeName, routes);
};

export default handleReqType;
