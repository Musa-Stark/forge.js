import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type NewCommentEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  commentAuthor: string;
  postTitle: string;
  commentText: string;
  commentUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
