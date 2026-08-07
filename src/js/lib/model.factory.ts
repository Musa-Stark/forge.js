import mongoose from "mongoose";
import type { SchemaDefinitionProperty } from "mongoose";

import buildSchema from "./schema.builder.js";
import AppLog from "../utils/AppLog.js";
import AppError from "../utils/AppError.js";

type Primitive = string | number | boolean | Date;

type ModelField = Primitive | SchemaDefinitionProperty<unknown>;

type ModelDefinition = Record<string, ModelField>;

const normalizeDefinition = (
  definition: ModelDefinition,
): Record<string, SchemaDefinitionProperty<unknown>> => {
  return Object.fromEntries(
    Object.entries(definition).map(([key, value]) => {
      // Already a schema definition
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        "type" in value
      ) {
        return [key, value];
      }

      switch (typeof value) {
        case "number":
          return [key, { type: Number, default: value }];

        case "string":
          return [key, { type: String, default: value }];

        case "boolean":
          return [key, { type: Boolean, default: value }];

        default:
          if (value instanceof Date) {
            return [key, { type: Date, default: value }];
          }

          return [key, value];
      }
    }),
  ) as Record<string, SchemaDefinitionProperty<unknown>>;
};

const createModel = (
  routeName: string,
  name: string,
  definition: ModelDefinition,
): any => {
  if (mongoose.modelNames().includes(name)) {
    return mongoose.model(name);
  }

  if (!definition)
    throw new AppError({
      message: `mongooseSchema for ${routeName} is required`,
      statusCode: 409,
      hint: "This issue requires a fix from the framework developer.",
      details: {
        handler: "",
        method: "",
        path: "",
      },
    });

  const schema = buildSchema(normalizeDefinition(definition));

  AppLog("db", "modelFactory", `${name} model created!`);

  return mongoose.model(name, schema);
};

export default createModel;
