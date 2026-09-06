import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type OrderShippedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  orderNumber: string;
  carrierName: string;
  userName: string;
  trackingNumber: string;
  estimatedDelivery: string;
  trackingUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
