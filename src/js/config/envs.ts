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
    if (config.mode === "manual") return;

    // if config.fieldsObj isn't found -> error
    if (!config.fieldsObj) vAError("fieldsObj");

    // keys that are required
    const requiredKeys = ["email", "password", "otp", "purpose"];

    // loop for missing keys
    for (const key of requiredKeys) {
      if (!(key in config.fieldsObj!)) vAError(`fieldsObj.${key}`);
    }

    // if value -> [placeholder]
    for (const [key, value] of Object.entries(config.fieldsObj!)) {
      placeholderError(key, value);
    }

    // if config.schemaObj isn't found -> error
    if (!config.schemaObj) vAError("schemaObj");

    // if modelName is missing
    if (!config.schemaObj?.modelName) vAError("schemaObj.modelName");

    // if modelName -> [modelName]
    placeholderError("modelName", config.schemaObj?.modelName!);

    // if schema is missing
    if (!config.schemaObj?.schema) vAError("schemaObj.schema");

    // auth modes
    const authMethods = ["credentials", "otp"];

    // if signupMode or loginMode not found
    if (!config.signupMode) vAError("signupMode");
    if (!config.loginMode) vAError("loginMode");

    if (!authMethods.includes(config.signupMode!))
      vAError(`signupMode as ${authMethods.join(" or ")}`);

    if (!authMethods.includes(config.loginMode!))
      vAError(`loginMode as ${authMethods.join(" or ")}`);
  } catch (error) {
    AppLog("x", "authConfigObj", (error as Error).message);
    process.exit(1);
  }
};

const setEnvs = (values: InternalConstructor): void => {
  validateAuth(values.authConfigObj!);

  // set default access_token age
  if (!values.authConfigObj.accessTokenAge)
    values.authConfigObj.accessTokenAge = "10m";

  // set default refresh_token age
  if (!values.authConfigObj.refreshTokenAge)
    values.authConfigObj.refreshTokenAge = "30d";

  // set default access_token name
  if (!values.authConfigObj.accessTokenName)
    values.authConfigObj.accessTokenName = "accessToken";

  // set default refresh_token name
  if (!values.authConfigObj.refreshTokenName)
    values.authConfigObj.refreshTokenName = "refreshToken";

  // set default refreshTokenRotationInterval
  if (!values.authConfigObj.refreshTokenRotationInterval)
    values.authConfigObj.refreshTokenRotationInterval = "0s"

  envs = values;
};

const getEnvs = (): InternalConstructor => {
  return envs;
};

export { setEnvs, getEnvs, envs };
