import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type SubscriptionCreatedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  planName: string;
  userName: string;
  billingCycle: string;
  nextBillingDate: string;
  billingUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
