import { collection, mongooseFields, zodFields } from "../../dist/js/index.js";

const userCollection = collection({
  reqType: "crud",
  routeName: "users",
  modelName: "User",
  mongooseSchemaObj: {
    name: mongooseFields.requiredString,
    Email: mongooseFields.email,
    password: mongooseFields.password,
    role: mongooseFields.role,
    profileImage: mongooseFields.fileMetaData,
    test: mongooseFields.fileMetaData,
  },
  routesArray: [
    {
      authRole: "adminOrOwner",
      handler: "readAll",
      method: "get",
      path: "/",
      validationKey: false,
      mongooseConfigObj: {
        hiddenFieldsArray: ["__v"],
      },
    },
    {
      authRole: "adminOrOwner",
      handler: "read",
      method: "get",
      path: "/:id",
      validationKey: false,
      // ownerShip: "self",
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
      fileArray: [
        {
          fieldName: "gallery",
          mongooseSchemaFieldName: "test",
          multiple: true,
        },
      ],
    },
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
