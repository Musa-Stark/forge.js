import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type ApiKeyRevokedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
    apiKeyName: string;
    userName: "there" | ({} & string) | ((context: ActionContext) => string);
    apiKeyPrefix: string;
    revokedBy: string;
    changeDate: "current-date" | ({} & string);
    apiKeysUrl: string;
    userEmail: string | ((context: ActionContext) => string);
    unsubscribeUrl: string;
  };
