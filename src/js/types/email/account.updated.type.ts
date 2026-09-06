import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type AccountUpdatedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  userName: string;
  changeDate: string;
  fieldChanged: string;
  newValue: string;
  userEmail: string;
  unsubscribeUrl: string;
};
