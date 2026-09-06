import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type SupportTicketEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  ticketId: string;
  ticketSubject: string;
  userName: string;
  ticketStatus: string;
  agentName: string;
  ticketUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
