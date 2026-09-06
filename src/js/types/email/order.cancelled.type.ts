import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type OrderCancelledEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  orderNumber: string;
  userName: string;
  cancellationReason: string;
  refundAmount: string;
  userEmail: string;
  unsubscribeUrl: string;
};
