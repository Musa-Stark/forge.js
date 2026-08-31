import { collection, zodFields } from "../../dist/js/index.js";

const accountCollection = collection({
  reqType: "account",
  routeName: "account",
  routesArray: [
    {
      handler: "getMe",
      method: "get",
      path: "/me",
      mongooseConfigObj: {
        hiddenFieldsArray: ["__v"],
      },
    },
    {
      handler: "updateMe",
      method: "patch",
      path: "/me",
      authRole: "adminOrOwner",
      ownerShip: "self",
      validationKey: "updateProfile",
      hashedFieldsArray: ["password"],
      mongooseConfigObj: {
        hiddenFieldsArray: ["!password"],
      },
    },
    {
      handler: "deleteMe",
      method: "delete",
      path: "/me",
      authRole: "adminOrOwner",
      ownerShip: "self"
    },
  ],
  validationsObj: {
    updateProfile: {
      name: zodFields.optionalString,
      password: zodFields.optionalString,
    },
  },
});

export default accountCollection;
