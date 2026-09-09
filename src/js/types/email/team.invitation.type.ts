import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";
import type { ActionContext } from "../ActionHandler.js";

export type TeamInvitationEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  inviterName: string;
  teamName: string;
  memberRole: string;
  inviteUrl: string;
  expiryDate: "current-date" | ({} & string);
  userEmail: string | ((context: ActionContext) => string);
  unsubscribeUrl: string;
};
