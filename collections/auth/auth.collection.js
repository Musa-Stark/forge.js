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
      mode: "otp",
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
      mode: "credentials",
    },
    {
      method: "post",
      handler: "resendOTP",
      path: "/resend-otp",
    },
    {
      method: "post",
      handler: "forgotPassword",
      path: "/forgot-password",
    },
    {
      method: "post",
      handler: "resetPassword",
      path: "/reset-password",
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
      purpose: zodFields.purposeOTP,
    },
    login: {
      email: zodFields.email,
      password: zodFields.password,
    },
    resendOTP: {
      email: zodFields.email,
      purpose: zodFields.purposeOTP,
    },
    forgotPassword: {
      email: zodFields.email,
    },
    resetPassword: {
      email: zodFields.email,
      password: zodFields.password,
    },
  },
});

export default authCollection;
