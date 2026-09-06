import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type MemberRemovedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  memberName: string;
  teamName: string;
  userName: string;
  actorName: string;
  changeDate: string;
  teamUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
