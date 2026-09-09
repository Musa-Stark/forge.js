import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type TwoFactorCodeEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  otpCode: string;
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  expiryMinutes: number;
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
