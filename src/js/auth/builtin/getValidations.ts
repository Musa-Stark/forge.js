import type { UnifiedField } from "../../lib/unified.types.ts";
import { buildZodObject } from "../../lib/zod.factory.js";
import fields from "../../lib/unified.fields.js";
import { getEnvs } from "../../config/envs.js";
import AppLog from "../../utils/AppLog.js";

const helper = (
  obj: Record<string, UnifiedField>,
  arr: string[],
  internal?: Record<string, UnifiedField>,
) => {
  return buildZodObject(obj, arr, internal).shape;
};

const getValidationsObj = (obj: Record<string, UnifiedField>) => {
  try {
    const { authConfigObj } = getEnvs();
    const { otp, purpose, email, password } = authConfigObj?.fieldsObj!;

    if (!otp || !purpose || !email || !password)
      throw new Error(
        "email, password, otp and purpose all fields are required in authConfig.fieldsObj ",
      );

    const login = helper(obj, [email, password]);

    let signupKeys = [];
    for (const key in obj) {
      signupKeys.push(key);
    }

    const signup = helper(obj, signupKeys);

    const verifyOTP = helper(
      {
        [otp]: fields.otp,
        [purpose]: fields.purposeOTP,
        ...obj,
      },
      [email, otp, purpose],
    );

    const resendOTP = helper({ [purpose]: fields.purposeOTP, ...obj }, [
      email,
      purpose,
    ]);
    const forgotPassword = helper(obj, [email]);

    return {
      login,
      signup,
      verifyOTP,
      resendOTP,
      forgotPassword,
      resetPassword: login,
    };
  } catch (error) {
    let message = (error as Error).message;
    if (message.includes("schema")) {
      message = message.replace("schema", "'authConfig.schemaObj.schema'");
      message = message.replace("does not exist", "is required");
      AppLog("x", "schemaObj", message);
    }
    process.exit(1);
  }
};

export default getValidationsObj;
