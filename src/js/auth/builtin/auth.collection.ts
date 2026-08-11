import { getEnvs } from "../../config/envs.js";
import type { Collection } from "../../types/Collection.js";

const collection = (vals: Collection) => {
  const { authConfigObj } = getEnvs();
  vals.mongooseSchemaObj = authConfigObj?.schemaObj?.schema!;

  return vals;
};

export const authCollection = collection({
  modelName: "User",
  reqType: "auth",
  routeName: "auth",
  routesArray: [
    {
      method: "post",
      handler: "signup",
      path: "/signup",
      mode: "otp",
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
  //   validationsObj: {
  //     signup: {
  //       name: fields.requiredString,
  //       email: fields.email,
  //       password: fields.password,
  //       provider: fields.provider,
  //     },
  //     verifyOTP: {
  //       email: fields.email,
  //       otp: fields.requiredString,
  //       purpose: fields.purposeOTP,
  //     },
  //     login: {
  //       email: fields.email,
  //       password: fields.password,
  //     },
  //     resendOTP: {
  //       email: fields.email,
  //       purpose: fields.purposeOTP,
  //     },
  //     forgotPassword: {
  //       email: fields.email,
  //     },
  //     resetPassword: {
  //       email: fields.email,
  //       password: fields.password,
  //     },
  //   },
});

export default authCollection;
