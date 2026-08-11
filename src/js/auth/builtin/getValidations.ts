import type { UnifiedField } from "../../lib/unified.types.ts";
import { buildZodObject } from "../../lib/zod.factory.js";
import fields from "../../lib/unified.fields.js";

const helper = (
  obj: Record<string, UnifiedField>,
  arr: string[],
  internal?: Record<string, UnifiedField>,
) => {
  return buildZodObject(obj, arr, internal).shape;
};

const getValidationsObj = (obj: Record<string, UnifiedField>) => {
  const login = helper(obj, ["email", "password"]);
  const signup = helper(obj, ["name", "email", "password"]);

  const verifyOTP = helper(
    {
      otp: fields.otp,
      purpose: fields.purposeOTP,
      ...obj,
    },
    ["email", "otp", "purpose"],
  );

  const resendOTP = helper({ purpose: fields.purposeOTP, ...obj }, [
    "email",
    "purpose",
  ]);
  const forgotPassword = helper(obj, ["email"]);

  return {
    login,
    signup,
    verifyOTP,
    resendOTP,
    forgotPassword,
    resetPassword: login,
  };
};

export default getValidationsObj;
