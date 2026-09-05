import { collection, zodFields, mongooseFields } from "../../dist/js/index.js";

const crudCollection = collection({
  type: "crud",
  route: "products",
  model: "Product",
  schema: {
    name: mongooseFields.requiredString,
    price: mongooseFields.requiredNumber,
    category: mongooseFields.objectArray,
    isAvailable: mongooseFields.boolean,
    description: mongooseFields.optionalString,
    owner: mongooseFields.userRef,
    profileImage: mongooseFields.fileMetaData,
    // cardNumber: mongooseFields.encryptedString,
    // cvv: mongooseFields.encryptedString,
  },
  routes: [
    {
      method: "get",
      path: "/",
      handler: "readAll",
      auth: "public",
      validation: false,
      // decryptedFields: ["cardNumber", "cvv"],
      config: {
        populate: "owner",
        hiddenFields: ["__v", "updatedAt"],
      },
    },
    {
      method: "get",
      path: "/:id",
      handler: "read",
      auth: "admin-or-owner",
      validation: false,
      // decryptedFields: ["cardNumber", "cvv"],
      config: {
        populate: "owner",
        hiddenFields: ["__v"],
      },
    },
    {
      method: "post",
      path: "/",
      handler: "create",
      auth: "authenticated",
      validation: "createProduct",
      // encryptedFields: ["cardNumber", "cvv"],
    },
    {
      method: "post",
      path: "/create/bulk",
      handler: "createBulk",
      auth: "admin",
    },
    {
      method: "post",
      path: "/:id/addFile",
      handler: "addFile",
      auth: "admin-or-owner",
      files: [
        {
          schemaField: "profileImage",
          paramField: "backgroundImage",
        },
      ],
    },
    {
      method: "patch",
      path: "/:id",
      handler: "update",
      auth: "admin-or-owner",
      validation: "update",
    },
    {
      method: "patch",
      path: "/:id/updateFile",
      handler: "updateFile",
      auth: "admin-or-owner",
      validation: "updateAvatar",
      files: [
        {
          paramField: "backgroundImage",
          schemaField: "profileImage",
          validationKey: "avatar",
        },
      ],
    },
    {
      method: "delete",
      path: "/:id",
      handler: "remove",
      auth: "admin-or-owner",
      validation: false,
    },
    {
      method: "delete",
      path: "/",
      handler: "removeMultiple",
      auth: "admin-or-owner",
      validation: "removeMultiple",
      config: {
        targetField: "ids"
      }
    },
    {

      method: "delete",
      path: "/all",
      handler: "removeAll",
      auth: "admin",
      validation: false,
    },
    {
      method: "delete",
      path: "/:id/deleteFile",
      handler: "deleteFile",
      auth: "admin-or-owner",
      validation: "deleteAvatar",
      files: [
        {
          schemaField: "profileImage",
          validationKey: "stark",
        },
      ],
    },
  ],
  validations: {
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
      stark: zodFields.requiredString,
    },
    removeMultiple: {
      ids: zodFields.requiredStringArray
    },
  },
});

export default crudCollection;
