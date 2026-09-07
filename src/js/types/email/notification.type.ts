import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type NotificationEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  notificationTitle: string;
  notificationSummary: string;
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  notificationBody: string;
  notificationUrl: string;
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
