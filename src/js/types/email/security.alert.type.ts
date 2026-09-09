import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type SecurityAlertEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "location" | "currentYear"> & {
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  activityDescription: string;
  loginTime: "current-time" | ({} & string);
  secureAccountUrl: string;
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
