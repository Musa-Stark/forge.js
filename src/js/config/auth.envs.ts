import type { AuthConfig } from "../types/Constructor.js";
import AppLog from "../utils/AppLog.js";

// validateAuthConfigError handling
const vAError = (str: string): void => {
  throw new Error(
    `authConfig.${str} is requried in StarkForge({}) ->  authConfig.`,
  );
};

const placeholderError = (key: string, value: string): void => {
  if (typeof value === "string" && value.startsWith("[")) {
    throw new Error(
      `"${value}" is just a placeholder, use a valid value for the key "${key}" in StarkForge({}) ->  authConfig.`,
    );
  }
};

// validateAuthConfigError
export const validateAuth = (config: AuthConfig): void => {
  try {
    // if mode is manual -> return;
    if (config.mode !== "builtin") return;

    // if value -> [placeholder]
    for (const [key, value] of Object.entries(config.fieldsObj!)) {
      placeholderError(key, value);
    }

    // if config.mongooseConfig isn't found -> error
    if (!config.mongooseConfig) vAError("mongooseConfig");

    // keys that are required
    const requiredKeys = ["email", "password", "otp", "purpose"];

    // loop for missing keys
    for (const key of requiredKeys) {
      if (!(key in config.fieldsObj!)) vAError(`fieldsObj.${key}`);
    }

    // if model -> [model]
    placeholderError("model", config.mongooseConfig?.model!);

    // if model isn't found
    if (!config.mongooseConfig?.model) vAError("mongooseConfig.model");

    // if schema is missing
    if (!config.mongooseConfig?.schema) vAError("mongooseConfig.schema");
  } catch (error) {
    AppLog("x", "authConfig", (error as Error).message);
    process.exit(1);
  }
};

export const authConfigValidation = (authConfig: any) => {
  // Token expiration
  authConfig.accessTokenAge ??= "10m";
  authConfig.refreshTokenAge ??= "30d";

  // Token rotation
  authConfig.rotateRefreshToken ??= true;
  authConfig.refreshTokenRotationInterval ??= "0s";

  // Token names
  authConfig.accessTokenName ??= "accessToken";
  authConfig.refreshTokenName ??= "refreshToken";

  // Return tokens
  authConfig.returnAccessToken ??= false;
  authConfig.returnRefreshToken ??= false;

  // User verification
  authConfig.verifyAccessUser ??= true;

  // Modes
  authConfig.loginMode ??= "otp";
  authConfig.signupMode ??= "otp";

  // Fields
  authConfig.fieldsObj ??= {
    email: "email",
    otp: "otp",
    password: "password",
    purpose: "purpose",
  };

  // fieldNames
  authConfig.fieldsObj.email ??= "email";
  authConfig.fieldsObj.otp ??= "otp";
  authConfig.fieldsObj.password ??= "password";
  authConfig.fieldsObj.purpose ??= "purpose";

  // Validation checkpoint
  validateAuth(authConfig);

  return authConfig;
};
