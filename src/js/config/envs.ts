import type { AuthConfig, InternalConstructor } from "../types/Constructor.ts";
import { defaultConfig } from "./defaultConfig.js";

let envs: InternalConstructor = { ...defaultConfig };

// validateAuthConfigError handling
const vAError = (str: string): void => {
  throw new Error(`authConfigObj.${str} is requried in StarkForge({})`);
};

// validateAuthConfigError
const validateAuth = (config: AuthConfig): void => {
  // if mode is manual -> return;
  if (config.mode === "manual") return;

  // if config.fieldsObj isn't found -> error
  if (!config.fieldsObj) vAError("fieldsObj");

  // keys that are required
  const requiredKeys = [
    "name",
    "email",
    "password",
    "provider",
    "otp",
    "purpose",
  ];

  // loop for missing keys
  for (const key of requiredKeys) {
    if (!(key in config.fieldsObj!)) vAError(`fieldsObj.${key}`);
  }

  // if config.schemaObj isn't found -> error
  if (!config.schemaObj) vAError("schemaObj");

  // if modelName is missing
  if (!config.schemaObj?.modelName) vAError("schemaObj.modelName");

  // if schema is missing
  if (!config.schemaObj?.schema) vAError("schemaObj.schema");

  // auth modes
  const authMethods = ["credentials", "otp"];

  // if signup or login not found
  if (!config.signup) vAError("signup");
  if (!config.login) vAError("login");

  if (!authMethods.includes(config.signup!))
    vAError(`signup as ${authMethods.join(" or ")}`);

  if (!authMethods.includes(config.login!))
    vAError(`login as ${authMethods.join(" or ")}`);
};

const setEnvs = (values: InternalConstructor): void => {
  validateAuth(values.authConfigObj!);

  envs = values;
};

const getEnvs = (): InternalConstructor => {
  return envs;
};

export { setEnvs, getEnvs, envs };

const obj = {
  name: "musa",
  email: "m@gmail.com",
  password: "musa123",
};
