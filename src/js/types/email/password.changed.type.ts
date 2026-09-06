import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type PasswordChangedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "deviceName" | "location" | "ipAddress" | "currentYear"> & {
  userName: string;
  changeDate: string;
  changeTime: string;
  accountSecurityUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
