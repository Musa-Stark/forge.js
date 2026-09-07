import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type AccountDeletedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  deletionDate: "current-date" | ({} & string);
 userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
