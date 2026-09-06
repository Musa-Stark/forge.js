import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type ReminderEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  reminderTitle: string;
  userName: string;
  reminderDueDate: string;
  reminderUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
