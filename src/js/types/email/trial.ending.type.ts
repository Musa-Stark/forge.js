import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type TrialEndingEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  daysRemaining: number;
  trialEndDate: string;
  userName: string;
  planName: string;
  billingUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
