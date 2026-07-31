import AppError from "../utils/AppError.js";
import { cloudinary, setupCloudinary } from "../config/cloudinary.js";
import type { Route } from "../types/Collection.ts";
import AppLog from "../utils/AppLog.js";

const handleDeleteFile = async (route: Route, body: any, item: any) => {
  setupCloudinary(route);

  const fileArray = route.fileArray;

  if (!Array.isArray(fileArray) || fileArray.length === 0)
    throw new AppError({
      message: "fileArray is required.",
      statusCode: 400,
      code: "UPLOAD_ARRAY_REQUIRED",
      hint:
        "Provide fileArray in the collection route configuration for delete handlers.",
      details: {
        handler: route.handler,
        method: route.method,
        path: route.path,
      },
    });

  if (fileArray.length > 1)
    AppLog(
      "warn",
      "deleteFile",
      `fileArray in collection has more than 1 items for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to delete.`,
    );

  const mongooseField = fileArray[0]?.mongooseSchemaFieldName;

  if (typeof mongooseField !== "string" || mongooseField.trim() === "")
    throw new AppError({
      message: "mongooseSchemaFieldName is required.",
      statusCode: 400,
      code: "UPLOAD_MONGOOSE_FIELD_REQUIRED",
      hint:
        "Provide mongooseSchemaFieldName in collection -> route -> fileArray [{...}].",
      details: {
        handler: route.handler,
        method: route.method,
        path: route.path,
      },
    });

  const mongooseFilesArray = item[mongooseField];

  if (!mongooseFilesArray)
    throw new AppError({
      message: `'${mongooseField}' field not found.`,
      statusCode: 400,
      code: "SCHEMA_FIELD_REQUIRED",
      hint:
        "Ensure mongooseSchemaFieldName matches an existing schema field.",
      details: {
        handler: route.handler,
        method: route.method,
        path: route.path,
      },
    });

  const validationIdentifierKey = fileArray[0]?.validationIdentifierKey;

  if (
    typeof validationIdentifierKey !== "string" ||
    validationIdentifierKey.trim() === ""
  )
    throw new AppError({
      message: "validationIdentifierKey is required.",
      statusCode: 400,
      code: "VALIDATION_KEY_REQUIRED",
      hint:
        "Provide validationIdentifierKey in collection -> route -> fileArray [{...}].",
      details: {
        handler: route.handler,
        method: route.method,
        path: route.path,
      },
    });

  if (!body[validationIdentifierKey])
    throw new AppError({
      message: `'${validationIdentifierKey}' is required.`,
      statusCode: 400,
      code: "VALIDATION_REQUIRED_FIELD_MISSING",
      hint: `Provide '${validationIdentifierKey}' in the request body.`,
      details: {
        handler: route.handler,
        method: route.method,
        path: route.path,
      },
    });

  const targetItem = mongooseFilesArray.find(
    (el: any) => el._id.toString() === body[validationIdentifierKey],
  );

  if (!targetItem)
    throw new AppError({
      message: `File with id '${body[validationIdentifierKey]}' not found.`,
      statusCode: 404,
      code: "CRUD_ITEM_NOT_FOUND",
      hint:
        "Verify the provided file identifier exists in the stored file array.",
      details: {
        handler: route.handler,
        method: route.method,
        path: route.path,
      },
    });

  if (
    typeof targetItem.storageKey !== "string" ||
    targetItem.storageKey.trim() === ""
  )
    throw new AppError({
      message: "storageKey is required.",
      statusCode: 400,
      code: "UPLOAD_STORAGE_KEY_REQUIRED",
      hint:
        "Ensure the stored file contains a valid storageKey before deletion.",
      details: {
        handler: route.handler,
        method: route.method,
        path: route.path,
      },
    });

  await cloudinary.uploader.destroy(targetItem.storageKey);

  return {
    deleted: true,
    _id: body[validationIdentifierKey],
    mongooseField,
  };
};

export default handleDeleteFile;