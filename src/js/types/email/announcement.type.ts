import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type AnnouncementEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  announcementTitle: string;
  announcementSummary: string;
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  announcementBody: string;
  learnMoreUrl: string;
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
