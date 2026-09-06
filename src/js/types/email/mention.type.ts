import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type MentionEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  mentionAuthor: string;
  contextTitle: string;
  mentionText: string;
  mentionUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
