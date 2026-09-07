import type { ActionContext } from "../../types/ActionHandler.js";
import { getCurrentYear } from "./auto-fields.js";

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
    if (typeof value === "function") config[key] = await config[key](context);
  }

  return {
    currentYear: getCurrentYear(),
    ...config,
  };
};
export default handleEmailTemplateConfig;
