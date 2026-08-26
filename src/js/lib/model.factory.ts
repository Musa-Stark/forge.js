import mongoose from "mongoose";
import type { SchemaDefinitionProperty } from "mongoose";

import buildSchema from "./schema.builder.js";
import AppLog from "../utils/AppLog.js";
import AppError from "../utils/AppError.js";

type Primitive = string | number | boolean | Date;

/**
 * A field can now be:
 * 1. UnifiedField  → { mongoose: ..., zod: ... }
 * 2. Classic Mongoose definition (backward compatible)
 * 3. Primitive value (also backward compatible)
 */
type ModelField =
  | { mongoose: SchemaDefinitionProperty<unknown>; zod?: any }
  | SchemaDefinitionProperty<unknown>
  | Primitive;

type ModelDefinition = Record<string, ModelField>;

/**
 * Extracts the pure Mongoose definition from any supported field format.
 */
const extractMongooseDefinition = (
  value: ModelField,
): SchemaDefinitionProperty<unknown> => {
  // Case 1: Unified field → { mongoose, zod }
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "mongoose" in value
  ) {
    return value.mongoose as SchemaDefinitionProperty<unknown>;
  }

  // Case 2: Already a classic Mongoose schema definition
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "type" in value
  ) {
    return value as SchemaDefinitionProperty<unknown>;
  }

  // Case 3: Primitive values (string | number | boolean | Date)
  switch (typeof value) {
    case "number":
      return { type: Number, default: value };
    case "string":
      return { type: String, default: value };
    case "boolean":
      return { type: Boolean, default: value };
    default:
      if (value instanceof Date) {
        return { type: Date, default: value };
      }
      // Fallback (arrays, nested objects, etc.)
      return value as SchemaDefinitionProperty<unknown>;
  }
};

/**
 * Converts the whole definition object into a clean Mongoose-compatible definition.
 */
const normalizeDefinition = (
  definition: ModelDefinition,
): Record<string, SchemaDefinitionProperty<unknown>> => {
  return Object.fromEntries(
    Object.entries(definition).map(([key, value]) => [
      key,
      extractMongooseDefinition(value),
    ]),
  );
};

/**
 * Creates (or returns existing) Mongoose model.
 */
const createModel = (
  name: string,
  definition: ModelDefinition,
  routeName?: string,
): any => {
  // Return existing model if already registered
  if (mongoose.modelNames().includes(name)) {
    return mongoose.model(name);
  }

  if (!definition) {
    console.log(name);
    throw new AppError({
      message: `mongooseSchema for ${routeName} is required`,
      statusCode: 409,
      hint:
        name.toLowerCase() === "users" || name.toLowerCase() === "user"
          ? "If modelName for User model is written in auth collection, make sure mongooseSchema is written there too."
          : `Make sure mongooseSchema is also written in ${routeName?.endsWith("s") ? routeName.slice(0, -1) : routeName} collection.`,
      details: {
        handler: "",
        method: "",
        path: "",
      },
    });
  }

  const cleanDefinition = normalizeDefinition(definition);
  const schema = buildSchema(cleanDefinition);

  AppLog("db", "modelFactory", `${name} model created!`);

  return mongoose.model(name, schema);
};

export default createModel;
