import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type TwoFactorCodeEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  otpCode: string;
  userName: string;
  expiryMinutes: number;
  userEmail: string;
  unsubscribeUrl: string;
};
