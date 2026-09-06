import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type OrganizationInvitationEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  organizationName: string;
  inviterName: string;
  memberRole: string;
  inviteUrl: string;
  expiryDate: string;
  userEmail: string;
  unsubscribeUrl: string;
};
