export type RouteMethod = "get" | "post" | "patch" | "delete";
import type { RoutePath } from "./Routepath.js";
import type { authHandlers } from "./authHandlers.ts";
import type { crudHandlers } from "./crudHandlers.ts";
import type { uploadHandlers } from "./uploadHandlers.js";
import type { accountHandlers } from "./accountHandlers.js";
export type AuthRole = "admin" | "adminOrOwner" | "authenticated" | "public";
import type { Upload } from "./upload.ts";
export type AuthMode = "credentials" | "otp";
// | "magic-link" | "oauth";

export type Handler =
  | authHandlers
  | crudHandlers
  | uploadHandlers
  | accountHandlers;

export interface Route {
  method: RouteMethod;
  path: RoutePath;
  handler: Handler;
  validationKey?: string | boolean;
  authRole?: AuthRole;
  ownerShip?: "self" | "owner";
  mongooseConfigObj?: {
    populateKey?: string | boolean;
    hiddenFieldsArray?: string[];
    removeMultipleFieldKey?: "ids" | "write_the_field_name" | (string & {});
  };
  // middlewareArray?: MiddlewareInput;
  fileArray?: Upload[];
  // emailsArray?: Email | Email[];
  mode?: AuthMode;
  encryptedFieldsArray?: string[];
  decryptedFieldsArray?: string[];
  hashedFieldsArray?: string[]
}