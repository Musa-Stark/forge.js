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
      path: "/",
      authRole: "adminOrOwner",
      ownerShip: "self",
      validationKey: "updateProfile",
      hashedFieldsArray: ["password"],
      mongooseConfigObj: {
        hiddenFieldsArray: ["!password"]
      }
    },
  ],
  validationsObj: {
    updateProfile: {
      firstName: zodFields.optionalString,
      lastName: zodFields.optionalString,
      password: zodFields.optionalString,
    },
  },
});

export default accountCollection;
