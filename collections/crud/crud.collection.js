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
    owner: mongooseFields.userRef
  },
  routesArray: [
    {
      method: "get",
      path: "/",
      handler: "readAll",
      authRole: "public",
    },
    {
      method: "get",
      path: "/:id",
      handler: "read",
      authRole: "public",
    },
    {
      method: "post",
      path: "/",
      handler: "create",
      authRole: "authenticated",
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
    create: {
      name: zodFields.requiredString,
      price: zodFields.requiredNumber,
      category: zodFields.objectArray,
      isAvailable: zodFields.boolean,
      description: zodFields.optionalString,
    },
    update: {
      name: zodFields.requiredString,
      price: zodFields.requiredNumber,
      category: zodFields.objectArray,
      isAvailable: zodFields.boolean,
      description: zodFields.optionalString,
    },
  },
});

export default crudCollection;
