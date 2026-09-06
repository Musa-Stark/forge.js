import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type MagicLinkEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  userName: string;
  magicLinkUrl: string;
  expiryMinutes: number;
  userEmail: string;
  unsubscribeUrl: string;
};
