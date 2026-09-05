import type { Collection, MongooseObj, SchemaField } from "./Collection.ts";
import type { DurationType } from "../config/duration.ts";
import type { UnifiedField } from "../lib/unified.types.js";

// auth config types and interface
export type authMode = "credentials" | "otp";
export interface AuthConfig {
  mode: "builtin" | "manual";

  returnAccessToken?: boolean;
  returnRefreshToken?: boolean;

  rotateRefreshToken?: boolean;
  refreshTokenRotationInterval?: DurationType;

  verifyAccessUser?: boolean;

  fieldsObj?: {
    email: "email" | "write_a_custom_field_name" | (string & {});
    password: "password" | "write_a_custom_field_name" | (string & {});
    otp: "otp" | "write_a_custom_field_name" | (string & {});
    purpose: "purpose" | "write_a_custom_field_name" | (string & {});
  };
  schemaObj?: {
    model: "User" | "WRITE_A_CUSTOM_USER_Model_Name" | (string & {});
    schema: Record<string, UnifiedField>;
  };

  accessTokenName?: "access_token" | "write_a_custom_name" | (string & {});
  refreshTokenName?: "refresh_token" | "write_a_custom_name" | (string & {});

  accessTokenAge?: DurationType;
  refreshTokenAge?: DurationType;

  signupMode?: authMode;
  loginMode?: authMode;
}

export interface Constructor {
  authConfigObj: AuthConfig;
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
  systemEmailSender?: string;
  resendAPIKey?: string;
}

export interface InternalConstructor extends Constructor {
  userModelName?: string;
}
