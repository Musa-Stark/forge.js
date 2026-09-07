import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type InvoiceEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  invoiceNumber: string;
  invoiceAmount: string;
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  invoiceDate: "current-date" | ({} & string);
  invoiceDueDate: "current-date" | ({} & string);
  invoiceUrl: string;
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
