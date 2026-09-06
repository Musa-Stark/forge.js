import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type InvoiceEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  invoiceNumber: string;
  invoiceAmount: string;
  userName: string;
  invoiceDate: string;
  invoiceDueDate: string;
  invoiceUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
