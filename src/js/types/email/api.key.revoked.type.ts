import type { CommonEmailPlaceholders } from "./static-config.type.ts";
import type { AutoDerivedEmailFields } from "../../email/utils/auto-fields.type.js";

export type ApiKeyRevokedEmailPlaceholders = CommonEmailPlaceholders &
  Pick<AutoDerivedEmailFields, "currentYear"> & {
  apiKeyName: string;
  userName: string;
  apiKeyPrefix: string;
  revokedBy: string;
  changeDate: string;
  apiKeysUrl: string;
  userEmail: string;
  unsubscribeUrl: string;
};
