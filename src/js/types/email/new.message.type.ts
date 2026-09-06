import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type NewMessageEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  senderName: string;
  messagePreview: string;
  messageUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
