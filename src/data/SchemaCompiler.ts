import { z, type ZodType } from "zod";
import type { CollectionSchema, CollectionValidations, SchemaField, ValidationField } from "../types/Collection.js";
import { ConfigurationError } from "../errors/index.js";

interface UnifiedLike {
  mongoose: unknown;
  zod: ZodType;
}

const isUnified = (field: unknown): field is UnifiedLike =>
  typeof field === "object" && field !== null && "mongoose" in field && "zod" in field;

const isZod = (field: unknown): field is ZodType =>
  typeof field === "object" && field !== null && typeof (field as { safeParse?: unknown }).safeParse === "function";

/** A `{ mongoose }` or `{ zod }` wrapper that is missing its other half (plain JavaScript can do this). */
const isHalfUnified = (field: unknown): boolean => {
  if (typeof field !== "object" || field === null || Array.isArray(field) || isZod(field)) return false;
  const keys = Object.keys(field);
  return keys.length > 0 && keys.every((key) => key === "mongoose" || key === "zod") && keys.length === 1;
};

/**
 * Turns the declarative `schema` / `validations` of a collection into the
 * concrete Mongoose definition and Zod object.
 */
export class SchemaCompiler {
  /** Mongoose definition: unwraps `{ mongoose, zod }` fields. */
  toMongooseDefinition(schema: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(schema)) {
      if (isHalfUnified(field)) {
        throw new ConfigurationError({
          message: `Schema field '${key}' has only one of 'mongoose' and 'zod'.`,
          hint: "A wrapped field needs both: { mongoose: { type: String }, zod: z.string() }. For a plain Mongoose definition, write it without the wrapper.",
        });
      }
      out[key] = isUnified(field) ? field.mongoose : field;
    }
    return out;
  }

  /** Names of fields declared with `select: false`. */
  secretFieldsOf(schema: Record<string, unknown>): string[] {
    return Object.entries(this.toMongooseDefinition(schema))
      .filter(([, def]) => typeof def === "object" && def !== null && (def as { select?: unknown }).select === false)
      .map(([key]) => key);
  }

  /** Zod object for one named validation group. */
  toZodObject(rules: Record<string, ValidationField>, context: string): z.ZodObject<Record<string, ZodType>> {
    const shape: Record<string, ZodType> = {};
    for (const [key, rule] of Object.entries(rules)) {
      if (isUnified(rule)) shape[key] = rule.zod;
      else if (isZod(rule)) shape[key] = rule;
      else {
        throw new ConfigurationError({
          message: `Validation '${context}' → field '${key}' is neither a Zod type nor a { mongoose, zod } field.`,
          hint: "Use `z.string()`... or one of the helpers exported as `fields`.",
        });
      }
    }
    return z.object(shape);
  }

  /** The Zod type of a schema field when it carries one. */
  zodOf(field: SchemaField): ZodType | undefined {
    return isUnified(field) ? field.zod : undefined;
  }

  compileValidations(validations: CollectionValidations | undefined, route: string): Map<string, z.ZodObject<Record<string, ZodType>>> {
    const compiled = new Map<string, z.ZodObject<Record<string, ZodType>>>();
    for (const [name, rules] of Object.entries(validations ?? {})) {
      compiled.set(name, this.toZodObject(rules, `${route}.${name}`));
    }
    return compiled;
  }
}
