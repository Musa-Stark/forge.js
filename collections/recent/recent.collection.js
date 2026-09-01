import {
  collection,
  defineRoutes,
  mongooseFields,
  zodFields,
  getModel,
} from "../../dist/js/index.js";

const recentCollection = collection({
  reqType: "crud",
  routeName: "recents",
  modelName: "Recent",
  routesArray: [
    {
      method: "get",
      handler: "readAll",
      path: "/",
      authRole: "public",
    },
  ],

  mongooseSchemaObj: {
    title: mongooseFields.requiredString,
    type: mongooseFields.requiredString,
  },
});

export default recentCollection;
