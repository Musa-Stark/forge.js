import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type ReceiptEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  receiptNumber: string;
  userName: string;
  paymentDate: string;
  paymentMethod: string;
  paymentAmount: string;
  receiptUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
