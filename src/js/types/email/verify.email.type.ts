import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type VerifyEmailEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  verificationUrl: string;
  expiryMinutes: number;
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
