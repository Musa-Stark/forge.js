import type { InternalConstructor } from "../types/Constructor.ts";
import { defaultConfig } from "./defaultConfig.js";

let envs = { ...defaultConfig };

const setEnvs = (values: InternalConstructor): void => {
  envs = values;
};

const getEnvs = (): InternalConstructor => {
  return envs;
};

export { setEnvs, getEnvs, envs };
