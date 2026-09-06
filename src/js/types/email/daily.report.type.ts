import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type DailyReportEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  reportDate: string;
  userName: string;
  metricSignups: number;
  metricActiveUsers: number;
  metricRevenue: string;
  reportUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
