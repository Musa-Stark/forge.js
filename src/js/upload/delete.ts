import AppError from "../utils/AppError.js";
import { cloudinary, setupCloudinary } from "../config/cloudinary.js";
import type { Route } from "../types/Collection.ts";
import AppLog from "../utils/AppLog.js";

const handleDeleteFile = async (routeObj: Route, body: any, item: any) => {
  setupCloudinary(routeObj);

  const files = routeObj.files;

  if (!Array.isArray(files) || files.length === 0)
    throw new AppError({
      message: "files is required.",
      statusCode: 400,
      hint:
        "Provide files in the collection routeObj configuration for delete handlers.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  if (files.length > 1)
    AppLog(
      "warn",
      "deleteFile",
      `files in collection has more than 1 items for handler: '${routeObj.handler}', method: '${routeObj.method}' and path: '${routeObj.path}' to delete.`,
    );

  const mongooseField = files[0]?.schemaField;

  if (typeof mongooseField !== "string" || mongooseField.trim() === "")
    throw new AppError({
      message: "schemaField is required.",
      statusCode: 400,
      hint:
        "Provide schemaField in collection -> routeObj -> files [{...}].",
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
        "Ensure schemaField matches an existing schema field.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  const validationKey = files[0]?.validationKey;

  if (
    typeof validationKey !== "string" ||
    validationKey.trim() === ""
  )
    throw new AppError({
      message: "validationKey is required.",
      statusCode: 400,
      hint:
        "Provide validationKey in collection -> routeObj -> files [{...}].",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  if (!body[validationKey])
    throw new AppError({
      message: `'${validationKey}' is required.`,
      statusCode: 400,
      hint: `Provide '${validationKey}' in the request body.`,
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  const targetItem = mongooseFilesArray.find(
    (el: any) => el._id.toString() === body[validationKey],
  );

  if (!targetItem)
    throw new AppError({
      message: `File with id '${body[validationKey]}' not found.`,
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
    _id: body[validationKey],
    mongooseField,
  };
};

export default handleDeleteFile;