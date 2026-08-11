// utils/zodBuilders.ts
import { z } from "zod";
import type { UnifiedField } from "./unified.types.js";

type SchemaObj = Record<string, UnifiedField>;

/**
 * Builds a Zod object schema from unified fields.
 *
 * @param schemaObj - The unified schema (e.g. authConfig.user.schema)
 * @param keys      - Optional list of fields to include.
 *                    If omitted, all fields are included.
 */
export function buildZodObject(
  schemaObj: SchemaObj,
  keys?: string[],
  internal?: Record<string, UnifiedField>,
): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {};
  const fieldNames = keys ?? Object.keys(schemaObj);

  for (const key of fieldNames) {
    const field = schemaObj[key];

    if (!field) {
      throw new Error(`Field "${key}" does not exist in the schema`);
    }

    if (!field?.zod) {
      throw new Error(`Field "${key}" is missing a zod definition`);
    }

    shape[key] = field.zod;
  }

  return z.object(shape);
}

/**
 * Returns the Zod schema of a single field
 */
export function getZodField(schemaObj: SchemaObj, key: string): z.ZodTypeAny {
  const field = schemaObj[key];

  if (!field?.zod) {
    throw new Error(`Field "${key}" not found or missing zod definition`);
  }

  return field.zod;
}

/**
 * Safer version – skips missing fields instead of throwing
 */
export function buildZodObjectSafe(
  schemaObj: SchemaObj,
  keys?: string[],
): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {};
  const fieldNames = keys ?? Object.keys(schemaObj);

  for (const key of fieldNames) {
    const field = schemaObj[key];
    if (field?.zod) {
      shape[key] = field.zod;
    }
  }

  return z.object(shape);
}
