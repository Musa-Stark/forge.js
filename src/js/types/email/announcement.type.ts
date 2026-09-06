import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type AnnouncementEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  announcementTitle: string;
  announcementSummary: string;
  userName: string;
  announcementBody: string;
  learnMoreUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
