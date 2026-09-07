import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type PasswordChangedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "deviceName" | "location" | "ipAddress" | "currentYear"> & {
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  changeDate: "current-date" | ({} & string);
  changeTime: "current-time" | ({} & string);
  accountSecurityUrl: string;
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
