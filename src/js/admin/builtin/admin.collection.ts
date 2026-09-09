import type { Collection } from "../../types/Collection.js";

const collection = (vals: Collection) => {
  return vals;
};

const adminCollection = collection({
  type: "admin",
  route: "admin",
  routes: [
    {
      auth: "admin",
      handler: "checkAdmin",
      method: "get",
      path: "/check",
    },
  ],
});

export default adminCollection;
