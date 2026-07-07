import mongoose, { Schema } from "mongoose";
import type { SchemaDefinition, SchemaDefinitionProperty } from "mongoose";

type BuildSchemaDefinition = Record<string, SchemaDefinitionProperty<unknown>>;

const buildSchema = (definition: BuildSchemaDefinition): Schema => {
  const schemaObject: SchemaDefinition = {};

  for (const key in definition) {
    const value = definition[key];

    // CASE 1: primitive constructors (String, Number, Boolean, Date, etc.)
    if (
      value === String ||
      value === Number ||
      value === Boolean ||
      value === Date ||
      value === Buffer
    ) {
      schemaObject[key] = { type: value };
      continue;
    }

    // CASE 2: already mongoose-style object
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      schemaObject[key] = value;
      continue;
    }

    // CASE 3: array schema
    if (Array.isArray(value)) {
      schemaObject[key] = value;
      continue;
    }
  }

  return new mongoose.Schema(schemaObject, {
    timestamps: true,
  });
};

export default buildSchema;
