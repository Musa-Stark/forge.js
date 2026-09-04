import {
  collection,
  defineRoutes,
  mongooseFields,
  zodFields,
  getModel,
} from "../../dist/js/index.js";

const recentCollection = collection({
  type: "crud",
  route: "recents",
  model: "Recent",
  routes: [
    {
      method: "get",
      handler: "readAll",
      path: "/",
      auth: "public",
      config: {
        hiddenFields: ["__v", "updatedAt"]
      },
      actions: {
        after: [
          {
            type: "custom",
            handler: async ({ result }) => {
              const Model = getModel({ model: "User" });
              const users = await Model.find();
              return await [...result, ...users];
            },
          },
        ],
      },
    },
  ],

  schema: {
    title: mongooseFields.requiredString,
    type: mongooseFields.requiredString,
  },
});

export default recentCollection;
