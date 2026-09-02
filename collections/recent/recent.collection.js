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
      mongooseConfigObj: {
        hiddenFieldsArray: ["__v", "updatedAt"]
      },
      actions: {
        after: [
          {
            type: "custom",
            handler: async ({ result }) => {
              const Model = getModel({ modelName: "User" });
              const users = await Model.find();
              return await [...result, ...users];
            },
          },
        ],
      },
    },
  ],

  mongooseSchemaObj: {
    title: mongooseFields.requiredString,
    type: mongooseFields.requiredString,
  },
});

export default recentCollection;
