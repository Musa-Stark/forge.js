import streamifier from "streamifier";
import AppError from "../utils/AppError.js";
import { cloudinary, setupCloudinary } from "../config/cloudinary.js";
import type { StoreFile } from "../types/StoreFile.js";
import type { Route } from "../types/Collection.ts";
import type { Request } from "express";
import AppLog from "../utils/AppLog.js";

const uploadFile = (file: Express.Multer.File): Promise<StoreFile> => {
  setupCloudinary();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "framework",
      },
      async (error, result) => {
        if (error || !result) {
          return reject(
            new AppError({
              message: "Cloudinary upload failed.",
              statusCode: 500,
            }),
          );
        }

        resolve({
          url: result.secure_url,
          storageKey: result.public_id,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          format: result.format,
          resourceType: result.resource_type,
        });
      },
    );

    streamifier.createReadStream(file.buffer).pipe(stream);
  });
};

const handleUpdateFile = async (
  req: Request,
  route: Route,
  body: any,
  item: any,
) => {
  // reqFilesArray
  const reqFilesArray = Object.keys(req.files!);

  // if uploadArray = undefined, [], false, length = 0
  const uploadArray = route.uploadArray;
  if (!Array.isArray(uploadArray) || uploadArray.length === 0)
    throw new AppError({
      message: `uploadArray is required for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to update.`,
      statusCode: 400,
    });

  // if more than 1 file
  if (uploadArray.length > 1)
    AppLog(
      "warn",
      "updateFile",
      `uploadArray in collection has more than 1 items for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to update.`,
    );

  // if mongooseSchemaFieldName not found
  const mongooseField = uploadArray[0]?.mongooseSchemaFieldName;
  if (typeof mongooseField !== "string" || mongooseField.trim() === "")
    throw new AppError({
      message: `mongooseSchemaFieldName is required in collection uploadArray for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to update.`,
      statusCode: 400,
    });

  // if files not found
  if (!reqFilesArray.length)
    throw new AppError({
      message: `Files are required for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to update.`,
      statusCode: 400,
    });

  // if req.files have more than 1 files
  if (reqFilesArray.length > 1)
    AppLog(
      "warn",
      "updateFile",
      `req.files has more than 1 fieldNames: '${reqFilesArray.join(", ")}' for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to update.`,
    );

  // if mongooseField not found in body
  const mongooseFilesArray = item[mongooseField];
  if (!mongooseFilesArray)
    throw new AppError({
      message: `'${mongooseField}' is not found in item (mongodb) as mongooseSchemaFieldName of handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to update.`,
      statusCode: 400,
    });

  const identifierKey = uploadArray[0]!.identifierKey;
  // if identifierKey not found
  if (typeof identifierKey !== "string" || identifierKey.trim() === "")
    throw new AppError({
      message: `identifierKey is required in collection uploadArray for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to update.`,
      statusCode: 400,
    });

  // targetItem - oldItem
  const oldItem = mongooseFilesArray.find(
    (el: any) => el._id.toString() === body[identifierKey],
  );

  if (!body[identifierKey])
    throw new AppError({
      message: `identifierKey: '${identifierKey}' is required in collection validationsObj or req.body for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to update.`,
      statusCode: 404,
    });

  // if target item not found
  if (!oldItem)
    throw new AppError({
      message: `File with _id: ${body[identifierKey]} not found in array: ${mongooseField} for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to update.`,
      statusCode: 400,
    });

  // uploadFile
  if (!Array.isArray(req.files)) {
    const updated = await uploadFile(req.files![reqFilesArray![0]!]![0]!);

    // remove old from cloudinary
    await cloudinary.uploader.destroy(oldItem.storageKey);

    return { updated, mongooseField, _id: body[identifierKey] };
  }
};

export default handleUpdateFile;
