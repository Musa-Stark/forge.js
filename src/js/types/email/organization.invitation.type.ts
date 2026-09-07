import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type OrganizationInvitationEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  organizationName: string;
  inviterName: string;
  memberRole: string;
  inviteUrl: string;
  expiryDate: "current-date" | ({} & string);
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
