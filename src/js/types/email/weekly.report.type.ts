import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type WeeklyReportEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  reportPeriod: string;
  userName: string;
  metricSignups: number;
  metricActiveUsers: number;
  metricRevenue: string;
  reportUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
