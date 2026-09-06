import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type ContactFormEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  contactName: string;
  contactEmail: string;
  formMessage: string;
  userEmail: string;
  unsubscribeUrl: string;
};
