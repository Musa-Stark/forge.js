import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type OrderCancelledEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  orderNumber: string;
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  cancellationReason: string;
  refundAmount: string;
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
