import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type SecurityAlertEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "location" | "currentYear"> & {
  userName: string;
  activityDescription: string;
  loginTime: string;
  secureAccountUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
