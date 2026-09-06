import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type PaymentFailedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  paymentAmount: string;
  userName: string;
  failureReason: string;
  paymentMethod: string;
  paymentDate: string;
  updatePaymentUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
