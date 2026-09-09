import { zodFields, collection, mongooseFields } from "../../dist/js/index.js";

const authCollection = collection({
  type: "auth",
  route: "auth",
  model: "User",
  schema: {
    name: mongooseFields.requiredString,
    Email: mongooseFields.email,
    password: mongooseFields.password,
    role: mongooseFields.role,
    profileImage: mongooseFields.fileMetaData,
    test: mongooseFields.fileMetaData,
  },
  routes: [
    {
      method: "post",
      handler: "signup",
      path: "/signup",
      mode: "credentials",
      validation: "signup",
    },
    {
      method: "post",
      handler: "verifyOTP",
      path: "/verify-otp",
      validation: "verifyOTP",
    },
    {
      method: "post",
      handler: "login",
      path: "/login",
      mode: "otp",
      validation: "login",
    },
    {
      method: "post",
      handler: "resendOTP",
      path: "/resend-otp",
      validation: "resendOTP",
    },
    {
      method: "post",
      handler: "forgotPassword",
      path: "/forgot-password",
      validation: "forgotPassword",
    },
    {
      method: "post",
      handler: "resetPassword",
      path: "/reset-password",
      validation: "resetPassword",
    },
    {
      method: "get",
      handler: "logout",
      path: "/logout",
    },
  ],
  validations: {
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
