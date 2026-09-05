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
      validation: "signup",
      auth: "public",
    },
    {
      method: "post",
      handler: "verifyOTP",
      path: "/verify-otp",
      validation: "verifyOTP",
      auth: "authenticated",
    },
    {
      method: "post",
      handler: "login",
      path: "/login",
      mode: "otp",
      validation: "login",
      auth: "public",
    },
    {
      method: "post",
      handler: "resendOTP",
      path: "/resend-otp",
      validation: "resendOTP",
      auth: "authenticated",
    },
    {
      method: "post",
      handler: "forgotPassword",
      path: "/forgot-password",
      validation: "forgotPassword",
      auth: "authenticated",
    },
    {
      method: "post",
      handler: "resetPassword",
      path: "/reset-password",
      validation: "resetPassword",
      auth: "authenticated",
    },
    {
      method: "get",
      handler: "logout",
      path: "/logout",
      auth: "authenticated",
    },
    {
      method: "post",
      handler: "logout",
      path: "/logout",
      auth: "authenticated",
    },
    {
      method: "get",
      handler: "refresh",
      path: "/refresh-token",
      auth: "authenticated",
    },
    {
      method: "post",
      handler: "refresh",
      path: "/refresh-token",
      auth: "authenticated",
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
