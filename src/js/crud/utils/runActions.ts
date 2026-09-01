import type { Action } from "../../types/ActionHandler.js";
import type { CreateContext } from "../../types/ActionHandler.js";

const runActions = async (
  actions: Action[] | undefined,
  context: CreateContext,
) => {
  if (!actions?.length) return;

  const handlerMap: Record<string, any> = {
    custom: (item: Action) => item.handler(context),
  };

  for (const item of actions) {
    await handlerMap[item.type](item);
  }
};

export default runActions;
