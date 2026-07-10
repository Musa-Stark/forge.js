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
  routesArray: [
    {
      method: "post",
      handler: "signup",
      path: "/signup",
      mode: "credentials",
    },
    {
      method: "post",
      handler: "verifyOTP",
      path: "/verify-otp",
    },
    {
      method: "post",
      handler: "login",
      path: "/login",
      mode: "otp",
    },
  ],
  validationsObj: {
    signup: {
      name: zodFields.requiredString,
      email: zodFields.email,
      password: zodFields.password,
    },
    verifyOTP: {
      email: zodFields.email,
      otp: zodFields.requiredString,
    },
    login: {
      email: zodFields.email,
      password: zodFields.password,
    },
  },
});

export default authCollection;
