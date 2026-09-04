import { getEnvs } from "../../config/envs.js";
import type { Collection } from "../../types/Collection.js";
import type { Route } from "../../types/Collection.js";

const collection = (vals: Collection) => {
  const { authConfigObj } = getEnvs();
  vals.schema = authConfigObj?.schemaObj?.schema!;

  return vals;
};

const routes = (): Route[] => {
  return [
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
    {
      method: "post",
      handler: "logout",
      path: "/logout",
    },
    {
      method: "get",
      handler: "refresh",
      path: "/refresh-token",
    },
    {
      method: "post",
      handler: "refresh",
      path: "/refresh-token",
    },
  ];
};

export const authCollection = collection({
  model: "User",
  type: "auth",
  route: "auth",
  routes: routes(),
});

export default authCollection;
