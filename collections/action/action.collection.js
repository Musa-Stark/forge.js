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
    auth: "authenticated",
    validation: "PostAction",
    actions: {
      after: [
        {
          type: "custom",
          handler: async ({ model,route,  operation }) => {
            await recentHandler(route, operation);
          },
        },
      ],
    },
  },
]);

const actionCollection = collection({
  type: "crud",
  route: "actions",
  model: "Action",
  routes: routes,
  schema: {
    handler: mongooseFields.optionalString,
  },
  validations: {
    PostAction: {
      handler: zodFields.optionalString,
    },
  },
});

export default actionCollection;
