import type { Collection } from "../types/Collection.js";

const collection = (vals: Collection) => {
  return vals;
}

const healthCollection = collection({
  routeName: "health",
  reqType: "health",
  routesArray: [
    {
      handler: "healthGet",
      method: "get",
      path: "/",
      authRole: "public",
      validationKey: false,
    },
    {
      handler: "healthPost",
      method: "post",
      path: "/",
      authRole: "public",
      validationKey: false,
    },
    {
      handler: "healthPatch",
      method: "patch",
      path: "/",
      authRole: "public",
      validationKey: false,
    },
    {
      handler: "healthDelete",
      method: "delete",
      path: "/",
      authRole: "public",
      validationKey: false,
    },
  ],
});

export default healthCollection;
