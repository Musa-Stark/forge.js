import { zodFields, collection, mongooseFields } from "../../dist/js/index.js";

const authCollection = collection({
  reqType: "auth",
  routeName: "auth",
  modelName: "User",
  mongooseSchemaObj: {
    name: mongooseFields.requiredString,
    Email: mongooseFields.email,
    password: mongooseFields.password,
    role: mongooseFields.role,
    profileImage: mongooseFields.fileMetaData,
    test: mongooseFields.fileMetaData,
  },
  routesArray: [
    {
      method: "post",
      handler: "signup",
      path: "/signup",
      mode: "credentials",
      validationKey: "signup",
    },
    {
      method: "post",
      handler: "verifyOTP",
      path: "/verify-otp",
      validationKey: "verifyOTP",
    },
    {
      method: "post",
      handler: "login",
      path: "/login",
      mode: "otp",
      validationKey: "login",
    },
    {
      method: "post",
      handler: "resendOTP",
      path: "/resend-otp",
      validationKey: "resendOTP",
    },
    {
      method: "post",
      handler: "forgotPassword",
      path: "/forgot-password",
      validationKey: "forgotPassword",
    },
    {
      method: "post",
      handler: "resetPassword",
      path: "/reset-password",
      validationKey: "resetPassword",
    },
    {
      method: "get",
      handler: "logout",
      path: "/logout",
    },
  ],
  validationsObj: {
    signup: {
      name: zodFields.requiredString,
      Email: zodFields.email,
      password: zodFields.password,
      provider: zodFields.provider,
    },
    verifyOTP: {
      Email: zodFields.email,
      otp: zodFields.requiredString,
      purpose: zodFields.purposeOTP,
    },
    login: {
      Email: zodFields.email,
      password: zodFields.password,
    },
    resendOTP: {
      Email: zodFields.email,
      purpose: zodFields.purposeOTP,
    },
    forgotPassword: {
      Email: zodFields.email,
    },
    resetPassword: {
      Email: zodFields.email,
      password: zodFields.password,
    },
  },
});

export default authCollection;
