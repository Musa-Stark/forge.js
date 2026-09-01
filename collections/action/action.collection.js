import {
  collection,
  defineRoutes,
  mongooseFields,
  zodFields,
  getModel,
} from "../../dist/js/index.js";
import recentHandler from "../recent/recent.handler.js";

const routes = defineRoutes([
  {
    handler: "create",
    method: "post",
    path: "/",
    authRole: "authenticated",
    validationKey: "PostAction",
    actions: {
      after: [
        {
          type: "custom",
          handler: async ({ modelName,routeName,  operation }) => {
            await recentHandler(routeName, operation);
          },
        },
      ],
    },
  },
]);

const actionCollection = collection({
  reqType: "crud",
  routeName: "actions",
  modelName: "Action",
  routesArray: routes,
  mongooseSchemaObj: {
    handler: mongooseFields.optionalString,
  },
  validationsObj: {
    PostAction: {
      handler: zodFields.optionalString,
    },
  },
});

export default actionCollection;
