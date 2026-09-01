import type { Action } from "../../types/ActionHandler.js";
import type { CreateContext } from "../../types/ActionHandler.js";

const runActions = async (handlers: Action[] | undefined, context: CreateContext) => {
  if (!handlers?.length) return;

  for (const item of handlers) {
    await item.handler(context);
  }
};

export default runActions;
