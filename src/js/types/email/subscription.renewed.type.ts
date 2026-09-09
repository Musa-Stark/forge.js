import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type SubscriptionRenewedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  planName: string;
  billingCycle: string;
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  paymentAmount: string;
  nextBillingDate: "current-date" | ({} & string);
  billingUrl: string;
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
