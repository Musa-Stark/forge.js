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
    avatar: mongooseFields.imageMetaData,
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
      validationKey: false,
      // uploadArray: [
      //   {
      //     fieldName: "avatar",
      //     provider: "cloudinary",
      //     type: "image",
      //     multiple: true,
      //   },
      // ],
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
      path: "/:id/file",
      handler: "update",
      authRole: "adminOrOwner",
      validationKey: "updateAvatar",
      uploadArray: [
        {
          fieldName: "avatar",
          provider: "cloudinary",
          type: "image",
          multiple: true,
        },
      ],
    },
    {
      method: "delete",
      path: "/:id",
      handler: "remove",
      authRole: "adminOrOwner",
    },
    {
      method: "delete",
      path: "/",
      handler: "removeAll",
      authRole: "admin",
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
      name: zodFields.requiredString,
      price: zodFields.requiredNumber,
      category: zodFields.objectArray,
      isAvailable: zodFields.boolean,
      description: zodFields.optionalString,
    },
  },
});

export default crudCollection;
