import type { MongooseField } from "../lib/mongoose.fields.ts";
import type { UnifiedField } from "../lib/unified.types.js";
import type { OAuthProvider } from "../lib/OAuthProviders.ts";
import type { Role } from "../lib/roles.ts";
import type { ZodValidation } from "../lib/zod.fields.ts";
import type { Email } from "./email.ts";
import type { Route } from "./Route.js";

export type { Route } from "./Route.js";

/**
 * A database field. 
 * Can be a standard Mongoose field or a combined UnifiedField ({ mongoose, zod }).
 */
export type SchemaField = MongooseField | UnifiedField;

/**
 * Object defining all database fields for a model.
 * 
 * @example
 * ```ts
 * {
 *   name: fields.requiredString,
 *   price: fields.requiredNumber
 * }
 * ```
 */
export type CollectionSchema = Record<string, SchemaField>;

/**
 * A validation rule. 
 * Can be a standard Zod rule or a combined UnifiedField.
 */
export type ValidationField = ZodValidation | UnifiedField;

/**
 * Group of validation rules used to check incoming request data.
 * 
 * @example
 * ```ts
 * {
 *   createProduct: {
 *     name: zodFields.requiredString,
 *     price: zodFields.requiredNumber
 *   }
 * }
 * ```
 */
export type CollectionValidations = Record<
  string,
  Record<string, ValidationField> | ValidationField
>;

/**
 * The category of feature this collection handles.
 * 
 * - `crud`: Standard Create, Read, Update, Delete features.
 * - `auth`: Login, signup, and user sessions.
 * - `account`: Profile settings for the logged-in user.
 * - `health`: Server status and health checks.
 */
export type CollectionType = "auth" | "health" | "crud" | "account";

/**
 * The main configuration object to create your backend feature.
 * 
 * @example
 * ```ts
 * const productsCollection: Collection = {
 *   type: "crud",
 *   route: "products",
 *   model: "Product",
 *   schema: {
 *     name: fields.requiredString,
 *     price: fields.requiredNumber,
 *   },
 *   routes: [
 *     {
 *       method: "get",
 *       path: "/",
 *       handler: "readAll",
 *       auth: "public",
 *     },
 *   ],
 * };
 * ```
 */
export interface Collection {
  /**
   * The collection category.
   * 
   * @example "crud"
   */
  type: CollectionType;

  /**
   * The main URL path for this collection.
   * Use lowercase and plural words.
   * 
   * @example "products"
   */
  route: string;

  /**
   * List of API routes (endpoints) for this collection.
   */
  routes: Route[];

  /**
   * Name of your database model.
   * Use singular words starting with a capital letter.
   * 
   * @example "Product"
   */
  model?: string;

  /**
   * Database fields structure for your Mongoose model.
   */
  schema?: CollectionSchema;

  /**
   * Rules to validate data sent by users in requests.
   */
  validations?: CollectionValidations;
}

// Old names kept for backward compatibility
export type MongooseSchema = CollectionSchema;
export type MongooseObj = CollectionSchema;
export type ValidationsObj = CollectionValidations;
export type ReqType = CollectionType;