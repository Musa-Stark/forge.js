import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type FeedbackEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  userName: string;
  userEmail: string;
  feedbackText: string;
  feedbackRating: string;
  unsubscribeUrl: string;
};
