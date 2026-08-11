import type { Collection, MongooseObj, SchemaField } from "./Collection.ts";
import type { DurationType } from "../config/duration.ts";
import type { UnifiedField } from "../lib/unified.types.js";

// auth config types and interface
export type authMode = "credentials" | "otp";
export interface AuthConfig {
  mode: "builtin" | "manual";

  fieldsObj?: {
    otp: "otp" | "[field name]" | (string & {});
    purpose: "purpose" | "[field name]" | (string & {})
  };
  schemaObj?: {
    modelName: "User" | "[Model Name]" | (string & {});
    schema: Record<string, UnifiedField>;
  };

  signup?: authMode;
  login?: authMode;
}

export interface Constructor {
  authConfigObj?: AuthConfig;
  apiVersion: number;
  backendURL: string;
  cloudinaryAPIKey?: string;
  cloudinaryAPISecret?: string;
  cloudinaryCloudName?: string;
  cloudinaryFolderName?: string;
  collections?: Collection[];
  databaseName?: string;
  domain?: string;
  ENV: string;
  frontendURL?: string;
  frontendURLs?: string[];
  internalRoles?: string[];
  isOffline: boolean;
  jwtSecret?: string;
  masterKey?: string;
  maxReqLimit: number;
  mongoDBURI?: string;
  port: number;
  rateLimitDuration: DurationType;
  rateLimitMsg: string;
  adminEmailSender?: string;
  resendAPIKey?: string;
  tokenExpiry: DurationType;
}

export interface InternalConstructor extends Constructor {
  userModelName?: String;
}
