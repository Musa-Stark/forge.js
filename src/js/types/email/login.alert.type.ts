import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type LoginAlertEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "deviceName" | "location" | "ipAddress" | "currentYear"> & {
  userName: string;
  loginTime: string;
  confirmLoginUrl: string;
  secureAccountUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
