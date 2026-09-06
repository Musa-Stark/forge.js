import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type PasswordExpiringEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  daysRemaining: number;
  userName: string;
  expiryDate: string;
  resetUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
