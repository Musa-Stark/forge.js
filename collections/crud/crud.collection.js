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
      fileArray: [
        {
          fieldName: "avatar",
          multiple: true,
          mongooseSchemaFieldName: "profileImage",
        },
        {
          fieldName: "stark",
          mongooseSchemaFieldName: "profileImage",
          validationIdentifierKey: "profileImageId",
          multiple: true,
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
      method: "post",
      path: "/:id/addFile",
      handler: "addFile",
      authRole: "authenticated",
      fileArray: [{
        mongooseSchemaFieldName: "profileImage",
        fieldName: "backgroundImage"
      }]
    },
    {
      method: "patch",
      path: "/:id",
      handler: "update",
      authRole: "adminOrOwner",
      validationKey: "update"
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
      fileArray: [{
        mongooseSchemaFieldName: "profileImage",
        validationIdentifierKey: "stark"
      }]
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
      avatar: zodFields.requiredString,
      name: zodFields.requiredString,
    },
    deleteAvatar: {
      stark: zodFields.requiredString
    }
  },
});

export default crudCollection;
