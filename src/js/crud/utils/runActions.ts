import emailAction from "../../email/index.js";
import type { Action, ActionContext } from "../../types/ActionHandler.js";

const runActions = async (
  actions: Action[] | undefined,
  context: ActionContext,
) => {
  let result = context.result;
  if (!actions?.length) return;

  const handlerMap: Record<string, any> = {
    customAction: async (handler: any) => {
      const output = await handler({ ...context, result });
      console.log(output);
      if (output !== undefined) result = output;
    },
    emailAction: async (emailConfig: any) => {
      await emailAction(emailConfig, {
        ...context,
        result,
      });
    },
  };

  for (const action of actions) {
    for (const [type, config] of Object.entries(action)) {
      handlerMap[type]?.(config);
    }
  }

  return result;
};

export default runActions;
