import type { MongooseField } from "../fields/mongoose.fields.js";
import type { UnifiedField } from "../fields/unified.types.js";
import type { ZodType } from "zod";
import type { Route } from "./Route.js";

export type { Route } from "./Route.js";

/** A database field: a Mongoose field or a combined `{ mongoose, zod }` field. */
export type SchemaField = MongooseField | UnifiedField;

/** All database fields of a model. */
export type CollectionSchema = Record<string, SchemaField>;

/** A validation rule: a Zod type or a combined `{ mongoose, zod }` field. */
export type ValidationField = ZodType | UnifiedField;

/** Named groups of validation rules, referenced from `Route.validation`. */
export type CollectionValidations = Record<string, Record<string, ValidationField>>;

/** The feature a collection implements. */
export type CollectionType = "auth" | "health" | "crud" | "account" | "admin";

/**
 * Configuration for one backend feature.
 *
 * @example
 * ```ts
 * collection({
 *   type: "crud",
 *   route: "products",
 *   model: "Product",
 *   schema: { name: fields.requiredString, price: fields.requiredNumber },
 *   routes: [{ method: "get", path: "/", handler: "readAll", auth: "public" }],
 * });
 * ```
 */
export interface Collection {
  type: CollectionType;
  /** URL segment, e.g. `"products"` -> `/api/v1/products`. */
  route: string;
  routes: Route[];
  /** Model name (singular, capitalised). */
  model?: string;
  schema?: CollectionSchema;
  validations?: CollectionValidations;
}

// Old names kept for backward compatibility.
export type MongooseSchema = CollectionSchema;
export type MongooseObj = CollectionSchema;
export type ValidationsObj = CollectionValidations;
export type ReqType = CollectionType;
