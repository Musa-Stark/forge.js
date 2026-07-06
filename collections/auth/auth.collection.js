import { collection } from "../../dist/js/index.js";
import { mongooseFields } from "../../dist/js/index.js";
import { zodFields } from "../../dist/js/index.js";

const authCollection = collection({
  modelName: "User",
  reqType: "auth",
  routeName: "auth",
  routes: [{ method: "get", path: "/", authRole: "both", mode: "credentials" }],
});

export default authCollection;
