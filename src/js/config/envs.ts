import type { InternalConstructor } from "../types/Constructor.ts";
import type { CommonEmailPlaceholders } from "../types/email/static-config.type.js";
import { authConfigValidation } from "./auth.envs.js";
import { defaultConfig } from "./defaultConfig.js";
import { emailConfig } from "./email.envs.js";

let envs: InternalConstructor = { ...defaultConfig };

const setEnvs = (values: InternalConstructor): void => {
  // authConfig
  authConfigValidation(values.builtinConfig.auth);

  // emailConfig
  emailConfig(values.builtinConfig.email as CommonEmailPlaceholders)

  // Save final config
  envs = values;
};

const getEnvs = (): InternalConstructor => {
  return envs;
};

export { setEnvs, getEnvs, envs };
