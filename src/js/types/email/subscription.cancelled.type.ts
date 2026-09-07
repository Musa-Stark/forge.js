import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type SubscriptionCancelledEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  planName: string;
  cancellationDate: "current-date" | ({} & string);
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  resubscribeUrl: string;
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
