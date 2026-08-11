// types/Field.ts
import type { z } from "zod";
import type { SchemaDefinitionProperty } from "mongoose";

/**
 * A field that can produce both a Mongoose definition and a Zod schema.
 */
export type UnifiedField = {
  mongoose?: SchemaDefinitionProperty<any> | SchemaDefinitionProperty<any>[];
  zod?: z.ZodTypeAny;
};