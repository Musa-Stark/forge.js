import { zodFields } from "../../dist/js/index.js";
import { collection } from "../../dist/js/index.js";
import { mongooseFields } from "../../dist/js/index.js";

const healthCollection = collection({
  routeName: "health",
  modelName: "Health",
  reqType: "health",
  routes: [
    { handler: "healthGet", method: "get", path: "/" },
    { handler: "healthPost", method: "post", path: "/" },
    { handler: "healthPut", method: "put", path: "/" },
    { handler: "healthPatch", method: "patch", path: "/" },
    { handler: "healthDelete", method: "delete", path: "/" },
  ],
  mongooseSchema: {
    name: mongooseFields.requiredString,
  },
  validations: {
    showHealth: {
      name: zodFields.requiredString,
    },
  },
});

export default healthCollection;
