import type { Constructor } from "../types/Constructor.ts";
import { defaultConfig } from "./defaultConfig.js";

let envs = { ...defaultConfig };

const setEnvs = (values: Constructor): void => {
  envs = values;
};

const getEnvs = (): Constructor => {
  return envs;
};

export { setEnvs, getEnvs };
