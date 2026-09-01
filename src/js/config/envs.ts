import type { AuthConfig, InternalConstructor } from "../types/Constructor.ts";
import AppLog from "../utils/AppLog.js";
import { defaultConfig } from "./defaultConfig.js";

let envs: InternalConstructor = { ...defaultConfig };

// validateAuthConfigError handling
const vAError = (str: string): void => {
  throw new Error(
    `authConfigObj.${str} is requried in StarkForge({}) ->  authConfigObj.`,
  );
};

const placeholderError = (key: string, value: string): void => {
  if (typeof value === "string" && value.startsWith("[")) {
    throw new Error(
      `"${value}" is just a placeholder, use a valid value for the key "${key}" in StarkForge({}) ->  authConfigObj.`,
    );
  }
};

// validateAuthConfigError
const validateAuth = (config: AuthConfig): void => {
  try {
    // if mode is manual -> return;
    if (config.mode !== "builtin") return;

    // if value -> [placeholder]
    for (const [key, value] of Object.entries(config.fieldsObj!)) {
      placeholderError(key, value);
    }

    // if config.schemaObj isn't found -> error
    if (!config.schemaObj) vAError("schemaObj");
    // keys that are required
    const requiredKeys = ["email", "password", "otp", "purpose"];

    // loop for missing keys
    for (const key of requiredKeys) {
      if (!(key in config.fieldsObj!)) vAError(`fieldsObj.${key}`);
    }

    // if modelName -> [modelName]
    placeholderError("modelName", config.schemaObj?.modelName!);

    // if schema is missing
    if (!config.schemaObj?.schema) vAError("schemaObj.schema");
  } catch (error) {
    AppLog("x", "authConfigObj", (error as Error).message);
    process.exit(1);
  }
};

const setEnvs = (values: InternalConstructor): void => {
  const authConfig = values.authConfigObj;

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

  authConfig.fieldsObj.email ??= "email";
  authConfig.fieldsObj.otp ??= "otp";
  authConfig.fieldsObj.password ??= "password";
  authConfig.fieldsObj.purpose ??= "purpose";

  // Validation checkpoint
  validateAuth(authConfig);

  // Save final config
  envs = values;
};

const getEnvs = (): InternalConstructor => {
  return envs;
};

export { setEnvs, getEnvs, envs };
