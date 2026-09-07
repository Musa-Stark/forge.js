import type { ActionContext } from "../../types/ActionHandler.js";
import AppLog from "../../utils/AppLog.js";
import { getAutoDerivedFields, getCurrentYear } from "./auto-fields.js";

const handleEmailTemplateConfig = async (
  config: any,
  context: ActionContext,
) => {
  for (const [key, value] of Object.entries(config)) {
    // current-date
    if (value === "current-date") {
      config[key] = new Date().toLocaleDateString("en-PK", {
        dateStyle: "full",
      });
    }

    // current-time
    if (value === "current-time") {
      config[key] = new Date().toLocaleTimeString("en-PK", {
        timeStyle: "medium",
      });
    }

    // function
    if (typeof value === "function") {
      try {
        const result = await value(context);
        config[key] = result;

        if (result === undefined || result === null) {
          AppLog(
            "x",
            "emailTemplateConfig",
            `Invalid configuration for '${key}'. Make sure the function returns correct value in routes -> route -> actions.`,
          );
        }
      } catch (error) {
        console.error(`Function '${key}' failed:`, error);
        throw error;
      }
    }
  }

  // autoDerivedFields
  const autoDerivedFields = await getAutoDerivedFields({
    headers: context.req.headers,
    connection: context.req.connection,
    ip: context.req.ip,
    ips: context.req.ips,
    socket: context.req.socket,
  });

  // return spread config
  return {
    ...config,
    ...autoDerivedFields,
  };
};
export default handleEmailTemplateConfig;
