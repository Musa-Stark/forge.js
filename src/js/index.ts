import type { Constructor } from "./types/Constructor.ts";
import type { Collection } from "./types/Collection.ts";
import { defaultConfig } from "./config/defaultConfig.js";
import { setEnvs } from "./config/envs.js";

class StarkCore {
  config: Constructor;
  constructor(config: Partial<Constructor>) {
    this.config = {
      ...defaultConfig,
      ...config,
    };

    setEnvs(this.config);
  }
}

export default StarkCore;
export { default as startServer } from "./app.js";
export { default as mongooseFields } from "./lib/mongoose.fields.js";
export { default as zodFields } from "./lib/zod.fields.js";

export const collection = (values: Collection): Collection => {
  return values;
};