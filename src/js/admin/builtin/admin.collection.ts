import { collection } from "../../index.js";

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
