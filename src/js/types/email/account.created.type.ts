import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type AccountCreatedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  userEmail: string | ((context: ActionContext) => string);
  dashboardUrl: string;
  unsubscribeUrl: string;
};
