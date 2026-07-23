import type { Collection } from "./Collection.ts";
import type { DurationType } from "../config/duration.ts";

export interface Constructor {
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
  userModelName?: String
}