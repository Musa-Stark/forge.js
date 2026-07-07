import mongoose from "mongoose";
import type { SchemaDefinitionProperty } from "mongoose";

import buildSchema from "./schema.builder.js";
import AppLog from "../utils/AppLog.js";
import AppError from "../utils/AppError.js";

type ModelDefinition = Record<string, SchemaDefinitionProperty<unknown>>;

const createModel = (
  routeName: string,
  name: string,
  definition: ModelDefinition,
) => {
  if (!name)
    throw new AppError({
      message: `modelName for ${routeName} route is required`,
      statusCode: 409,
    });

  if (!definition)
    throw new AppError({
      message: `mongooseSchema for ${routeName} is required`,
      statusCode: 409,
    });

  const schema = buildSchema(definition);

  if (mongoose.modelNames().includes(name)) {
    return mongoose.model(name);
  }

  AppLog("db", "modelFactory", `${name} model created!`);

  return mongoose.model(name, schema);
};

export default createModel;