import { collection } from "../../dist/js/index.js";
import { mongooseFields } from "../../dist/js/index.js";
import { zodFields } from "../../dist/js/index.js";

const authCollection = collection({
  modelName: "User",
  reqType: "auth",
  routeName: "auth",

  mongooseSchemaObj: {
    name: mongooseFields.requiredString,
    email: mongooseFields.email,
    password: mongooseFields.password,
  },

  mongooseOTPSchemaObj: {
    maxOtpTries: 10,
    otpExpiry: "5m",
    name: mongooseFields.requiredString,
    email: mongooseFields.email,
    password: mongooseFields.password,
  },
  routesArray: [
    {
      method: "post",
      handler: "signup",
      path: "/signup",
      mode: "otp",
    },
    {
      handler: "signup",
      method: "post",
      path: "/login",
      mode: "credentials",
    },
  ],
  validationsObj: {
    signup: {
      name: zodFields.requiredString,
      email: zodFields.email,
      password: zodFields.password,
    },
  },
});

export default authCollection;
