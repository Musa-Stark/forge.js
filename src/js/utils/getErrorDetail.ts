import type { Route } from "../types/Collection.js";

const getErrorDetail = (routeObj: Route) => {
  return {
    handler: routeObj.handler,
    method: routeObj.method,
    path: routeObj.path,
  };
};

export default getErrorDetail