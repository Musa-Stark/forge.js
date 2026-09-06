import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type PaymentSuccessEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  paymentAmount: string;
  userName: string;
  paymentMethod: string;
  paymentDate: string;
  receiptUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
