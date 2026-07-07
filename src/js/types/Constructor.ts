import type { Collection } from "./Collection.ts";

export interface Constructor {
  apiVersion: number;
  backendURL: string;
  cloudinaryAPIKey?: string;
  cloudinaryAPISecret?: string;
  cloudinaryCloudName?: string;
  cloudinaryFolderName?: string;
  collections?: Collection[];
  databaseName?: string;
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
  rateLimitDuration: string | number;
  rateLimitMsg: string;
  adminEmailSender?: string;
  resendAPIKey?: string;
  tokenExpiry: string;
}
