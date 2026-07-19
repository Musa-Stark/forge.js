import AppError from "../utils/AppError.js";
import { cloudinary, setupCloudinary } from "../config/cloudinary.js";
import type { Route } from "../types/Collection.ts";
import AppLog from "../utils/AppLog.js";

const handleDeleteFile = async (route: Route, body: any, item: any) => {
  setupCloudinary();

  // if fileArray = undefined, [], false, length = 0
  const fileArray = route.fileArray;
  if (!Array.isArray(fileArray) || fileArray.length === 0)
    throw new AppError({
      message: `fileArray is missing or empty for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to delete.`,
      statusCode: 400,
    });

  // if more than 1 file
  if (fileArray.length > 1)
    AppLog(
      "warn",
      "deleteFile",
      `fileArray in collection has more than 1 items for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to delete.`,
    );

  // if mongooseSchemaFieldName not found
  const mongooseField = fileArray[0]?.mongooseSchemaFieldName;
  if (typeof mongooseField !== "string" || mongooseField.trim() === "")
    throw new AppError({
      message: `mongooseSchemaFieldName is required in collection fileArray for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to delete.`,
      statusCode: 400,
    });

  // if mongoose field not found in stored document
  const mongooseFilesArray = item[mongooseField];
  if (!mongooseFilesArray)
    throw new AppError({
      message: `'${mongooseField}' is not found in item (mongodb) as mongooseSchemaFieldName of handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to delete.`,
      statusCode: 400,
    });

  // validationIdentifierKey
  const validationIdentifierKey = fileArray[0]?.validationIdentifierKey;
  if (
    typeof validationIdentifierKey !== "string" ||
    validationIdentifierKey.trim() === ""
  )
    throw new AppError({
      message: `validationIdentifierKey is required in collection fileArray for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to delete.`,
      statusCode: 400,
    });

  // if identifier not provided in req.body
  if (!body[validationIdentifierKey])
    throw new AppError({
      message: `validationIdentifierKey: '${validationIdentifierKey}' is required in collection validationsObj or req.body for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to delete.`,
      statusCode: 400,
    });

  // find target file
  const targetItem = mongooseFilesArray.find(
    (el: any) => el._id.toString() === body[validationIdentifierKey],
  );

  if (!targetItem)
    throw new AppError({
      message: `File with _id: ${body[validationIdentifierKey]} not found in array: ${mongooseField} for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to delete.`,
      statusCode: 400,
    });

  // if storageKey missing
  if (
    typeof targetItem.storageKey !== "string" ||
    targetItem.storageKey.trim() === ""
  )
    throw new AppError({
      message: `storageKey not found for file with _id: ${body[validationIdentifierKey]}.`,
      statusCode: 400,
    });

  // delete from Cloudinary only
  await cloudinary.uploader.destroy(targetItem.storageKey);

  return {
    deleted: true,
    _id: body[validationIdentifierKey],
    mongooseField,
  };
};

export default handleDeleteFile;
