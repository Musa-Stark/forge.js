import type { Action } from "../../types/ActionHandler.js";
import type { CreateContext } from "../../types/ActionHandler.js";

const runActions = async (
  actions: Action[] | undefined,
  context: CreateContext,
) => {
  let result = context.result;
  if (!actions?.length) return;

  const handlerMap: Record<string, any> = {
    custom: async (item: Action) => {
      const output = await item.handler({ ...context, result });
      if (output !== undefined) result = output;
    },
  };

  for (const item of actions) {
    await handlerMap[item.type](item);
  }

  return result;
};

export default runActions;
