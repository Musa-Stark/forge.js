import type { Route } from "../types/Collection.js";

const getErrorDetail = (route: Route) => {
  return {
    handler: route.handler,
    method: route.method,
    path: route.path,
  };
};

export default getErrorDetail