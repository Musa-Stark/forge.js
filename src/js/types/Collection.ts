import type { MongooseField } from "../lib/mongoose.fields.ts";
import type { UnifiedField } from "../lib/unified.types.js";
import type { OAuthProvider } from "../lib/OAuthProviders.ts";
import type { Role } from "../lib/roles.ts";
import type { ZodValidation } from "../lib/zod.fields.ts";
import type { Email } from "./email.ts";
import type { Route } from "./Route.js";

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

export type MongooseObj = MongooseSchema | Record<string, SchemaField>;

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

export type { Route } from "./Route.js";