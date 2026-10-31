// types/Field.ts
import type { z } from "zod";
import type { SchemaDefinitionProperty } from "mongoose";

/**
 * A field that carries both a Mongoose definition (how it is stored) and a Zod
 * rule (how a request value is checked). Both parts are required: Forge
 * recognises a unified field by the presence of the two keys.
 */
export type UnifiedField = {
  mongoose: SchemaDefinitionProperty<any> | SchemaDefinitionProperty<any>[];
  zod: z.ZodTypeAny;
};