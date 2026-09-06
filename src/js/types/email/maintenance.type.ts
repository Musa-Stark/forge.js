import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type MaintenanceEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  maintenanceWindow: string;
  userName: string;
  maintenanceStart: string;
  maintenanceEnd: string;
  maintenanceImpact: string;
  userEmail: string;
  unsubscribeUrl: string;
};
