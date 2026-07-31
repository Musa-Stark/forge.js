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
        hiddenFieldsArray: ["__v"],
      },
    },
    {
      authRole: "public",
      handler: "read",
      method: "get",
      path: "/:id",
      validationKey: false,
      mongooseConfigObj: {
        hiddenFieldsArray: ["_id"],
      },
    },
    {
      authRole: "authenticated",
      handler: "create",
      method: "post",
      path: "/",
      validationKey: "create",
      fileArray: [
        {
          mongooseSchemaFieldName: "gallery",
          fieldName: "gallery",
          multiple: true,
        },
      ],
    },
    {
      authRole: "adminOrOwner",
      handler: "addFile",
      method: "patch",
      path: "/:id/addFile",
      fileArray: [{
        fieldName: "gallery",
        mongooseSchemaFieldName: "test",
        multiple: true
      }]
    }
  ],

  validationsObj: {
    create: {
      name: zodFields.requiredString,
      email: zodFields.email,
      password: zodFields.password,
    },
  },
});

export default userCollection;
