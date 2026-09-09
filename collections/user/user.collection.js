import {
  collection,
  mongooseFields,
  zodFields,
  defineRoutes
} from "../../dist/js/index.js";

const routes = defineRoutes([
    {
      auth: "admin-or-owner",
      handler: "readAll",
      method: "get",
      path: "/",
      validation: false,
      config: {
        hiddenFields: ["__v"],
      },
    },
    {
      auth: "admin-or-owner",
      handler: "read",
      method: "get",
      path: "/:id",
      validation: false,
      ownership: "self",
      config: {
        hiddenFields: ["_id", "!password"],
      },
    },
    {
      auth: "authenticated",
      handler: "create",
      method: "post",
      path: "/",
      validation: "create",
      files: [
        {
          schemaField: "gallery",
          paramField: "gallery",
          multiple: true,
        },
      ],
    },
    {
      auth: "admin-or-owner",
      handler: "addFile",
      method: "patch",
      path: "/:id/addFile",
      files: [
        {
          paramField: "gallery",
          schemaField: "test",
          multiple: true,
        },
      ],
    },
    {
      auth: "admin-or-owner",
      handler: "update",
      method: "patch",
      path: "/:id",
      hashedFields: ["password"],
      ownership: "self",
      validation: "update",
      config: {
        hiddenFields: ["_id", "!password"],
      },
    },
  ])

const userCollection = collection({
  type: "crud",
  route: "users",
  model: "User",
  schema: {
    name: mongooseFields.requiredString,
    Email: mongooseFields.email,
    password: mongooseFields.password,
    role: mongooseFields.role,
    profileImage: mongooseFields.fileMetaData,
    test: mongooseFields.fileMetaData,
  },
  routes: routes,

  validations: {
    create: {
      name: zodFields.requiredString,
      email: zodFields.email,
      password: zodFields.password,
    },
    update: {
      name: zodFields.requiredString,
      email: zodFields.email,
      password: zodFields.password,
    },
  },
});

export default userCollection;
