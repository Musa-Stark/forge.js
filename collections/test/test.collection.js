import { zodFields } from "../../dist/js/index.js";
import { mongooseFields } from "../../dist/js/index.js";
import { collection } from "../../dist/js/index.js";

const testCollection = collection({
  routeName: "tests",
  modelName: "Test",
  reqType: "crud",
  routes: [{ handler: "showHealth", method: "get", path: "/" }],
  mongooseSchema: {
    name: mongooseFields.requiredString,
  },
  validations: {
    showHealth: {
      name: zodFields.requiredString,
    },
  },
});

export default testCollection;
