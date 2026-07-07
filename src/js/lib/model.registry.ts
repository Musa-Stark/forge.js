// GLOBAL MODEL REGISTRY
import createModel from "./model.factory.js";

const registerModel: Record<string, ReturnType<typeof createModel>> = {};

export default registerModel;
