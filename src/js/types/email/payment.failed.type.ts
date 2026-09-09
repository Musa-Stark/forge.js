import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type PaymentFailedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  paymentAmount: string;
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  failureReason: string;
  paymentMethod: string;
  paymentDate: "current-date" | ({} & string);
  updatePaymentUrl: string;
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
