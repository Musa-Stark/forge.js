import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type OtpVerificationEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
    otpCode: string;
    userName: "there" | ({} & string) | ((context: ActionContext) => string);
    expiryMinutes: number;
    userEmail: string;
    unsubscribeUrl: string;
  };
