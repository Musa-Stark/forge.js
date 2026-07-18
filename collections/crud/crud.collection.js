import { collection, zodFields, mongooseFields } from "../../dist/js/index.js";

const crudCollection = collection({
  reqType: "crud",
  routeName: "products",
  modelName: "Product",
  mongooseSchemaObj: {
    name: mongooseFields.requiredString,
    price: mongooseFields.requiredNumber,
    category: mongooseFields.objectArray,
    isAvailable: mongooseFields.boolean,
    description: mongooseFields.optionalString,
    owner: mongooseFields.userRef,
    profileImage: mongooseFields.fileMetaData,
  },
  routesArray: [
    {
      method: "get",
      path: "/",
      handler: "readAll",
      authRole: "public",
      validationKey: false,
    },
    {
      method: "get",
      path: "/:id",
      handler: "read",
      authRole: "public",
      validationKey: false,
    },
    {
      method: "post",
      path: "/",
      handler: "create",
      authRole: "authenticated",
      validationKey: "createProduct",
      uploadArray: [
        {
          fieldName: "avatar",
          multiple: true,
          mongooseSchemaFieldName: "profileImage",
        },
      ],
    },
    {
      method: "post",
      path: "/create/bulk",
      handler: "createBulk",
      authRole: "admin",
    },
    {
      method: "patch",
      path: "/:id",
      handler: "update",
      authRole: "adminOrOwner",
    },
    {
      method: "patch",
      path: "/:id/updateFile",
      handler: "updateFile",
      authRole: "adminOrOwner",
      validationKey: "updateAvatar",
      uploadArray: [
        {
          fieldName: "avatar",
          mongooseSchemaFieldName: "profileImage",
        },
      ],
    },
    {
      method: "delete",
      path: "/:id",
      handler: "remove",
      authRole: "adminOrOwner",
      validationKey: false,
    },
    {
      method: "delete",
      path: "/",
      handler: "removeAll",
      authRole: "admin",
      validationKey: false,
    },
  ],
  validationsObj: {
    createProduct: {
      name: zodFields.requiredString,
      price: zodFields.requiredNumber,
      category: zodFields.objectArray,
      isAvailable: zodFields.booleanFalse,
      description: zodFields.optionalString,
    },
    update: {
      name: zodFields.requiredString,
      price: zodFields.requiredNumber,
      category: zodFields.objectArray,
      isAvailable: zodFields.boolean,
      description: zodFields.optionalString,
    },
    updateAvatar: {
      publicId: zodFields.requiredString,
      name: zodFields.requiredString,
    },
  },
});

export default crudCollection;
