import { collection, mongooseFields, zodFields } from "../../dist/js/index.js";

const userCollection = collection({
  reqType: "crud",
  routeName: "users",
  modelName: "User",
  routesArray: [
    {
      authRole: "public",
      handler: "readAll",
      method: "get",
      path: "/",
      validationKey: false,
      mongooseConfigObj: {
        hiddenFieldsArray: ["!password"],
      },
    },
    {
      authRole: "public",
      handler: "read",
      method: "get",
      path: "/:id",
      validationKey: false,
      mongooseConfigObj: {
        hiddenFieldsArray: ["__v", "!password"],
      },
    },
  ],
});

export default userCollection;
