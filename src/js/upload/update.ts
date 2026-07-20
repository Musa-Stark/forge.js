import streamifier from "streamifier";
import AppError from "../utils/AppError.js";
import { cloudinary, setupCloudinary } from "../config/cloudinary.js";
import type { StoreFile } from "../types/StoreFile.js";
import type { Route } from "../types/Collection.ts";
import type { Request } from "express";
import AppLog from "../utils/AppLog.js";

const uploadFile = (
  file: Express.Multer.File,
  route: Route,
): Promise<StoreFile> => {
  setupCloudinary(route);

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
              code: "UPLOAD_CLOUDINARY_FAILED",
              hint:
                "Verify your Cloudinary configuration, credentials, and network connectivity.",
              details: {
                handler: route.handler,
                method: route.method,
                path: route.path,
              },
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
  const reqFilesArray = Object.keys(req.files ?? {});

  const fileArray = route.fileArray;

  if (!Array.isArray(fileArray) || fileArray.length === 0)
    throw new AppError({
      message: "fileArray is required.",
      statusCode: 400,
      code: "UPLOAD_ARRAY_REQUIRED",
      hint:
        "Provide fileArray in the collection route configuration for update handlers.",
      details: {
        handler: route.handler,
        method: route.method,
        path: route.path,
      },
    });

  if (fileArray.length > 1)
    AppLog(
      "warn",
      "updateFile",
      `fileArray in collection has more than 1 items for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to update.`,
    );

  const mongooseField = fileArray[0]?.mongooseSchemaFieldName;

  if (typeof mongooseField !== "string" || mongooseField.trim() === "")
    throw new AppError({
      message: "mongooseSchemaFieldName is required.",
      statusCode: 400,
      code: "UPLOAD_MONGOOSE_FIELD_REQUIRED",
      hint:
        "Provide mongooseSchemaFieldName in collection -> fileArray configuration.",
      details: {
        handler: route.handler,
        method: route.method,
        path: route.path,
      },
    });

  if (!reqFilesArray.length)
    throw new AppError({
      message: "File is required.",
      statusCode: 400,
      code: "UPLOAD_FILE_REQUIRED",
      hint: "Upload a file using the configured upload field.",
      details: {
        handler: route.handler,
        method: route.method,
        path: route.path,
      },
    });

  if (reqFilesArray.length > 1)
    AppLog(
      "warn",
      "updateFile",
      `req.files has more than 1 fieldNames: '${reqFilesArray.join(", ")}' for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to update.`,
    );

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

  const validationIdentifierKey = fileArray[0]!.validationIdentifierKey;

  if (
    typeof validationIdentifierKey !== "string" ||
    validationIdentifierKey.trim() === ""
  )
    throw new AppError({
      message: "validationIdentifierKey is required.",
      statusCode: 400,
      code: "VALIDATION_KEY_REQUIRED",
      hint:
        "Provide validationIdentifierKey in collection -> fileArray configuration.",
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

  const oldItem = mongooseFilesArray.find(
    (el: any) => el._id.toString() === body[validationIdentifierKey],
  );

  if (!oldItem)
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

  if (!Array.isArray(req.files)) {
    const updated = await uploadFile(
      req.files![reqFilesArray[0]!]![0]!,
      route,
    );

    await cloudinary.uploader.destroy(oldItem.storageKey);

    return {
      updated,
      mongooseField,
      _id: body[validationIdentifierKey],
    };
  }
};

export default handleUpdateFile;