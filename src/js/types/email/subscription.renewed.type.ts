import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type SubscriptionRenewedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  planName: string;
  billingCycle: string;
  userName: string;
  paymentAmount: string;
  nextBillingDate: string;
  billingUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
