import { collection } from "../../dist/js/index.js";

const accountCollection = collection({
  reqType: "account",
  routeName: "account",
  routesArray: [
    {
      handler: "getMe",
      method: "get",
      path: "/me",
      mongooseConfigObj: {
        hiddenFieldsArray: ["__v"]
      }
    },
  ],
});

export default accountCollection;
