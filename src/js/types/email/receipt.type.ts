import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type ReceiptEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  receiptNumber: string;
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  paymentDate: "current-date" | ({} & string);
  paymentMethod: string;
  paymentAmount: string;
  receiptUrl: string;
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
