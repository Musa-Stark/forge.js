import AppError from "../utils/AppError.js";
import { cloudinary, setupCloudinary } from "../config/cloudinary.js";
import type { Route } from "../types/Collection.ts";
import AppLog from "../utils/AppLog.js";

const handleDeleteFile = async (routeObj: Route, body: any, item: any) => {
  setupCloudinary(routeObj);

  const fileArray = routeObj.fileArray;

  if (!Array.isArray(fileArray) || fileArray.length === 0)
    throw new AppError({
      message: "fileArray is required.",
      statusCode: 400,
      hint:
        "Provide fileArray in the collection routeObj configuration for delete handlers.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  if (fileArray.length > 1)
    AppLog(
      "warn",
      "deleteFile",
      `fileArray in collection has more than 1 items for handler: '${routeObj.handler}', method: '${routeObj.method}' and path: '${routeObj.path}' to delete.`,
    );

  const mongooseField = fileArray[0]?.mongooseSchemaFieldName;

  if (typeof mongooseField !== "string" || mongooseField.trim() === "")
    throw new AppError({
      message: "mongooseSchemaFieldName is required.",
      statusCode: 400,
      hint:
        "Provide mongooseSchemaFieldName in collection -> routeObj -> fileArray [{...}].",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  const mongooseFilesArray = item[mongooseField];

  if (!mongooseFilesArray)
    throw new AppError({
      message: `'${mongooseField}' field not found.`,
      statusCode: 400,
      hint:
        "Ensure mongooseSchemaFieldName matches an existing schema field.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
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
      hint:
        "Provide validationIdentifierKey in collection -> routeObj -> fileArray [{...}].",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  if (!body[validationIdentifierKey])
    throw new AppError({
      message: `'${validationIdentifierKey}' is required.`,
      statusCode: 400,
      hint: `Provide '${validationIdentifierKey}' in the request body.`,
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  const targetItem = mongooseFilesArray.find(
    (el: any) => el._id.toString() === body[validationIdentifierKey],
  );

  if (!targetItem)
    throw new AppError({
      message: `File with id '${body[validationIdentifierKey]}' not found.`,
      statusCode: 404,
      hint:
        "Verify the provided file identifier exists in the stored file array.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  if (
    typeof targetItem.storageKey !== "string" ||
    targetItem.storageKey.trim() === ""
  )
    throw new AppError({
      message: "storageKey is required.",
      statusCode: 400,
      hint:
        "Ensure the stored file contains a valid storageKey before deletion.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
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