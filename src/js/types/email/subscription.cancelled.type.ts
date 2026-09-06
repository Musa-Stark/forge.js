import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type SubscriptionCancelledEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  planName: string;
  cancellationDate: string;
  userName: string;
  resubscribeUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
