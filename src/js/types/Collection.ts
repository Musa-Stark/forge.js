import type { MongooseField } from "../lib/mongoose.fields.ts";
import type { UnifiedField } from "../lib/unified.types.js";
import type { OAuthProvider } from "../lib/OAuthProviders.ts";
import type { Role } from "../lib/roles.ts";
import type { ZodValidation } from "../lib/zod.fields.ts";
import type { RoutePath } from "./Routepath.ts";
import type { authHandlers } from "./authHandlers.ts";
import type { crudHandlers } from "./crudHandlers.ts";
import type { uploadHandlers } from "./uploadHandlers.js";
import type { accountHandlers } from "./accountHandlers.js";
import type { Email } from "./email.ts";
import type { Upload } from "./upload.ts";

export type Handler = authHandlers | crudHandlers | uploadHandlers | accountHandlers;

// export type Middleware = "upload";
// export type MiddlewareInput = Middleware | Middleware[];

export type AuthRole = "admin" | "adminOrOwner" | "authenticated" | "public";
export type RouteMethod = "get" | "post" | "patch" | "delete";
export type AuthMode = "credentials" | "otp";
// | "magic-link" | "oauth";

export interface Route {
  method: RouteMethod;
  path: RoutePath;
  handler: Handler;
  validationKey?: string | boolean;
  authRole?: AuthRole;
  mongooseConfigObj?: {
    populateKey?: string | boolean;
    hiddenFieldsArray?: string[];
  };
  // middlewareArray?: MiddlewareInput;
  fileArray?: Upload[];
  // emailsArray?: Email | Email[];
  mode?: AuthMode;
  encryptedFieldsArray?: string[];
  decryptedFieldsArray?: string[];
}

/**
 * A schema field can be either the old pure Mongoose field
 * or the new UnifiedField ({ mongoose, zod })
 */
export type SchemaField = MongooseField | UnifiedField;

/**
 * Flexible schema type — no longer forces `status` and `role`
 */
export type MongooseSchema = {
  [key: string]: SchemaField;
};

export type MongooseObj =  MongooseSchema | Record<string, SchemaField>

/**
 * A single validation field can be:
 * - pure Zod schema (old style)
 * - UnifiedField (new style) → we will extract .zod later
 */
export type ValidationField = ZodValidation | UnifiedField;

export type ValidationsObj = {
  [key: string]: Record<string, ValidationField> | ValidationField;
};

export type ReqType = "auth" | "health" | "crud" | "account";
// | "realtime"

export interface Collection {
  reqType: ReqType;
  routeName: string;
  routesArray: Route[];
  modelName?: string;
  mongooseSchemaObj?: MongooseObj;
  validationsObj?: ValidationsObj;
}