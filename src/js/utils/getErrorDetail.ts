import type { Route } from "../types/Collection.js";

const getErrorDetail = (routeObj: Route, model?: string) => {
  return {
    handler: routeObj.handler,
    method: routeObj.method,
    path: routeObj.path,
    model
  };
};

export default getErrorDetail