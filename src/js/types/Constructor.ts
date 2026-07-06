import type { Collection } from "./Collection.ts";

export interface Constructor {
  port: number;
  collections?: Collection[];
  apiVersion: number;
  jwtSecret?: string;
  isOffline: boolean;
  masterKey?: string;
  ENV: string;
  tokenExpiry: string;
  internalRoles?: string[];
  resendAPIKey?: string;
  rateLimitDuration: string | number;
  maxReqLimit: number;
  rateLimitMsg: string;
  cloudinaryAPIKey?: string;
  cloudinaryCloudName?: string;
  cloudinaryAPISecret?: string;
  cloudinaryFolderName?: string;
}
