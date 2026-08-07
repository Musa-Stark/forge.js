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
    cardNumber: mongooseFields.encryptedString,
    // cvv: mongooseFields.encryptedString
  },
  routesArray: [
    {
      method: "get",
      path: "/",
      handler: "readAll",
      authRole: "public",
      validationKey: false,
      decryptedFieldsArray: ["cardNumber", "cvv"],
      mongooseConfigObj: {
        populateKey: "owner",
        hiddenFieldsArray: ["__v", "updatedAt"],
      },
    },
    {
      method: "get",
      path: "/:id",
      handler: "read",
      authRole: "adminOrOwner",
      validationKey: false,
      decryptedFieldsArray: ["cardNumber", "cvv?"],
      mongooseConfigObj: {
        populateKey: "owner",
        hiddenFieldsArray: ["__v"]
      }
    },
    {
      method: "post",
      path: "/",
      handler: "create",
      authRole: "authenticated",
      validationKey: "createProduct",
      encryptedFieldsArray: ["cardNumber", "cvv?"]
    },
    {
      method: "post",
      path: "/create/bulk",
      handler: "createBulk",
      authRole: "admin",
    },
    {
      method: "post",
      path: "/:id/addFile",
      handler: "addFile",
      authRole: "adminOrOwner",
      fileArray: [
        {
          mongooseSchemaFieldName: "profileImage",
          fieldName: "backgroundImage",
        },
      ],
    },
    {
      method: "patch",
      path: "/:id",
      handler: "update",
      authRole: "adminOrOwner",
      validationKey: "update",
    },
    {
      method: "patch",
      path: "/:id/updateFile",
      handler: "updateFile",
      authRole: "adminOrOwner",
      validationKey: "updateAvatar",
      fileArray: [
        {
          fieldName: "backgroundImage",
          mongooseSchemaFieldName: "profileImage",
          validationIdentifierKey: "avatar",
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
    {
      method: "delete",
      path: "/:id/deleteFile",
      handler: "deleteFile",
      authRole: "adminOrOwner",
      validationKey: "deleteAvatar",
      fileArray: [
        {
          mongooseSchemaFieldName: "profileImage",
          validationIdentifierKey: "stark",
        },
      ],
    },
  ],
  validationsObj: {
    createProduct: {
      name: zodFields.requiredString,
      price: zodFields.requiredNumber,
      category: zodFields.objectArray,
      isAvailable: zodFields.booleanFalse,
      description: zodFields.optionalString,
      cardNumber: zodFields.requiredString,
    },
    update: {
      name: zodFields.requiredString,
      price: zodFields.requiredNumber,
      category: zodFields.objectArray,
      isAvailable: zodFields.boolean,
      description: zodFields.optionalString,
    },
    updateAvatar: {
      avatar: zodFields.requiredString,
      name: zodFields.requiredString,
    },
    deleteAvatar: {
      stark: zodFields.requiredString,
    },
  },
});

export default crudCollection;
