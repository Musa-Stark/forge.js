import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type WeeklyReportEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  reportPeriod: string;
  userName: "there" | (object & string) | ((context: ActionContext) => string);
  metricSignups: number;
  metricActiveUsers: number;
  metricRevenue: string;
  reportUrl: string;
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
