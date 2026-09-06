import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type TeamInvitationEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  inviterName: string;
  teamName: string;
  memberRole: string;
  inviteUrl: string;
  expiryDate: string;
  userEmail: string;
  unsubscribeUrl: string;
};
