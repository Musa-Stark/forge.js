/** The part of a field definition that holds `ref` or `refPath`. */
export interface ReferenceDefinition {
  ref?: unknown;
  refPath?: unknown;
}

/**
 * Finds the reference a schema field declares, or `undefined` for a plain field.
 *
 * Understands the forms Mongoose accepts: `{ type: ObjectId, ref: "User" }`, an array of them
 * (`[{ type: ObjectId, ref: "User" }]`), `{ type: [{ ... }] }`, and any of these wrapped in a
 * `{ mongoose, zod }` field.
 */
export const referenceOf = (field: unknown): ReferenceDefinition | undefined => {
  if (Array.isArray(field)) return referenceOf(field[0]);
  if (typeof field !== "object" || field === null) return undefined;
  const definition = field as { mongoose?: unknown; type?: unknown } & ReferenceDefinition;
  if (definition.mongoose !== undefined) return referenceOf(definition.mongoose);
  if (definition.ref !== undefined || definition.refPath !== undefined) return definition;
  return Array.isArray(definition.type) ? referenceOf(definition.type[0]) : undefined;
};
