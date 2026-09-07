import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";;

export type OtpVerificationEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
    otpCode: string;
    userName: string;
    expiryMinutes: number;
    userEmail: string;
    unsubscribeUrl: string;
  };
