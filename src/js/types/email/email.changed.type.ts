import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type EmailChangedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  userName: string;
  oldEmail: string;
  newEmail: string;
  verificationUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
