import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type OrderConfirmationEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  orderNumber: string;
  userName: string;
  orderDate: string;
  orderTotal: string;
  orderUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
