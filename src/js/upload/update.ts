import streamifier from "streamifier";
import AppError from "../utils/AppError.js";
import { cloudinary, setupCloudinary } from "../config/cloudinary.js";
import type { StoreFile } from "../types/StoreFile.js";
import type { Route } from "../types/Collection.ts";
import type { Request } from "express";
import AppLog from "../utils/AppLog.js";
import { getEnvs } from "../config/envs.js";

const uploadFile = (
  file: Express.Multer.File,
  routeObj: Route,
): Promise<StoreFile> => {
  setupCloudinary(routeObj);

  const { cloudinaryFolderName } = getEnvs();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: cloudinaryFolderName || "starkForge",
      },
      async (error, result) => {
        if (error || !result) {
          return reject(
            new AppError({
              message: "Cloudinary upload failed.",
              statusCode: 500,
              hint: "Verify your Cloudinary configuration, credentials, and network connectivity.",
              details: {
                handler: routeObj.handler,
                method: routeObj.method,
                path: routeObj.path,
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
  routeObj: Route,
  body: any,
  item: any,
) => {
  const reqFilesArray = Object.keys(req.files ?? {});

  const files = routeObj.files;

  if (!Array.isArray(files) || files.length === 0)
    throw new AppError({
      message: "files is required.",
      statusCode: 400,
      hint: "Provide files in the collection routeObj configuration for update handlers.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  if (files.length > 1)
    AppLog(
      "warn",
      "updateFile",
      `files in collection has more than 1 items for handler: '${routeObj.handler}', method: '${routeObj.method}' and path: '${routeObj.path}' to update.`,
    );

  const mongooseField = files[0]?.schemaField;

  if (typeof mongooseField !== "string" || mongooseField.trim() === "")
    throw new AppError({
      message: "schemaField is required.",
      statusCode: 400,
      hint: "Provide schemaField in collection -> routeObj -> files [{...}].",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  if (!reqFilesArray.length)
    throw new AppError({
      message: "File is required.",
      statusCode: 400,
      hint: "Upload a file using the configured upload field.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  if (reqFilesArray.length > 1)
    AppLog(
      "warn",
      "updateFile",
      `req.files has more than 1 fieldNames: '${reqFilesArray.join(", ")}' for handler: '${routeObj.handler}', method: '${routeObj.method}' and path: '${routeObj.path}' to update.`,
    );

  const mongooseFilesArray = item[mongooseField];

  if (!mongooseFilesArray)
    throw new AppError({
      message: `'${mongooseField}' field not found.`,
      statusCode: 400,
      hint: "Ensure schemaField matches an existing schema field.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  const validationKey = files[0]!.validationKey;

  if (
    typeof validationKey !== "string" ||
    validationKey.trim() === ""
  )
    throw new AppError({
      message: "validationKey is required.",
      statusCode: 400,
      hint: "Provide validationKey in collection -> routeObj -> files [{...}].",
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

  const oldItem = mongooseFilesArray.find(
    (el: any) => el._id.toString() === body[validationKey],
  );

  if (!oldItem)
    throw new AppError({
      message: `File with id '${body[validationKey]}' not found.`,
      statusCode: 404,
      hint: "Verify the provided file identifier exists in the stored file array.",
      details: {
        handler: routeObj.handler,
        method: routeObj.method,
        path: routeObj.path,
      },
    });

  if (!Array.isArray(req.files)) {
    const updated = await uploadFile(req.files![reqFilesArray[0]!]![0]!, routeObj);

    await cloudinary.uploader.destroy(oldItem.storageKey);

    return {
      updated,
      mongooseField,
      _id: body[validationKey],
    };
  }
};

export default handleUpdateFile;
