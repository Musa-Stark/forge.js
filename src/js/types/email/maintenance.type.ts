import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type MaintenanceEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  maintenanceWindow: string;
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  maintenanceStart: string;
  maintenanceEnd: string;
  maintenanceImpact: string;
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
