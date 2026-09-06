import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type ApiKeyCreatedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  apiKeyName: string;
  userName: string;
  apiKeyPrefix: string;
  actorName: string;
  changeDate: string;
  apiKeysUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
