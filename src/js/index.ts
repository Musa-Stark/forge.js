import type { Constructor } from "./types/Constructor.ts";
import type { Collection } from "./types/Collection.ts";
import { defaultConfig } from "./config/defaultConfig.js";
import { setEnvs } from "./config/envs.js";

class StarkForge {
  config: Constructor;
  constructor(object: Partial<Constructor>) {
    this.config = {
      ...defaultConfig,
      ...object,
    };

    setEnvs(this.config);
  }
}

export { app, startServer } from "./app.js";
export { default as mongooseFields } from "./lib/mongoose.fields.js";
export { default as fields } from "./lib/unified.fields.js";
export { default as zodFields } from "./lib/zod.fields.js";
export { generateJWTSecret, generateMasterKey } from "./utils/libsodium.js";
export { default as getModel } from "./utils/getModel.js";
export { default as getItem } from "./crud/utils/getItem.js";

export const collection = (object: Collection): Collection => {
  return object;
};

export default StarkForge;
