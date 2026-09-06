import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type NotificationEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  notificationTitle: string;
  notificationSummary: string;
  userName: string;
  notificationBody: string;
  notificationUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
