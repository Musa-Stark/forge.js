import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type OrderShippedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  orderNumber: string;
  carrierName: string;
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  trackingNumber: string;
  estimatedDelivery: string;
  trackingUrl: string;
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
