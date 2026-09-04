import { collection, zodFields } from "../../dist/js/index.js";

const accountCollection = collection({
  type: "account",
  route: "account",
  routes: [
    {
      handler: "getMe",
      method: "get",
      path: "/me",
      config: {
        hiddenFields: ["__v"],
      },
    },
    {
      handler: "updateMe",
      method: "patch",
      path: "/me",
      auth: "adminOrOwner",
      ownership: "self",
      validation: "updateProfile",
      hashedFields: ["password"],
      config: {
        hiddenFields: ["!password"],
      },
    },
    {
      handler: "deleteMe",
      method: "delete",
      path: "/me",
      auth: "adminOrOwner",
      ownership: "self"
    },
  ],
  validations: {
    updateProfile: {
      name: zodFields.optionalString,
      password: zodFields.optionalString,
    },
  },
});

export default accountCollection;
