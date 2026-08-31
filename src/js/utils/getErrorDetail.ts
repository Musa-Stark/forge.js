import type { Route } from "../types/Collection.js";

const getErrorDetail = (routeObj: Route, modelName?: string) => {
  return {
    handler: routeObj.handler,
    method: routeObj.method,
    path: routeObj.path,
    modelName
  };
};

export default getErrorDetail