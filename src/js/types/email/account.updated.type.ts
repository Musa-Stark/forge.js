import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type AccountUpdatedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
    userName: "there" | ({} & string) | ((context: ActionContext) => string);
    changeDate: "current-date" | ({} & string);
    fieldChanged: string;
    newValue: string;
    userEmail: string | ((context: ActionContext) => string);
    unsubscribeUrl: string;
  };
