import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type NewDeviceLoginEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "deviceName" | "location" | "ipAddress" | "currentYear"> & {
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  loginTime: "current-time" | ({} & string);
  secureAccountUrl: string;
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
