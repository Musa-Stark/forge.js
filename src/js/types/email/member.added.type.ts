import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type MemberAddedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  memberName: string;
  teamName: string;
  userName: string;
  memberEmail: string;
  memberRole: string;
  teamUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
