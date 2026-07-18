import streamifier from "streamifier";
import AppError from "../utils/AppError.js";
import { cloudinary, setupCloudinary } from "../config/cloudinary.js";
import type { StoreFile } from "../types/StoreFile.js";
import type { Route } from "../types/Collection.ts";
import type { Request } from "express";
import AppLog from "../utils/AppLog.js";
import { STATUS_CODES } from "node:http";

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
          publicId: result.public_id,
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
  // if uploadArray = undefined, [], false, length = 0
  if (!Array.isArray(route.uploadArray) || route.uploadArray.length === 0)
    throw new AppError({
      message: `uploadArray is required for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to update`,
      statusCode: 400,
    });

  // if mongooseSchemaFieldName not found
  const mongooseField = route.uploadArray[0]?.mongooseSchemaFieldName;
  if (typeof mongooseField !== "string" || mongooseField.trim() === "")
    throw new AppError({
      message: `mongooseSchemaFieldName is required for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to update`,
      statusCode: 400,
    });

  // if files not found
  if (!Object.keys(req.files!).length)
    throw new AppError({
      message: `Files are required for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to update`,
      statusCode: 400,
    });

  // files array
  const files = Object.values(req.files!).flat();

  // if more than 1 file
  if (files.length > 1)
    AppLog(
      "warn",
      "updateFile",
      "uploadArray has more than 1 items. Using the first one for updating purpose. uploadArray[0].",
    );

  // if mongooseField not found in body
  const filesArray = item[mongooseField]
  if (!filesArray)
    throw new AppError({
      message: `${mongooseField} is not found in item (mongodb) of handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to update`,
      statusCode: 400,
    });

  console.log(filesArray)
  console.log(body)

  for (const el of filesArray) {
    console.log()
  }

  // const oldPublicId = item[mongooseField][0].publicId;
  // console.log(oldPublicId);

  // uploadFile
  // const uploaded = await uploadFile(files[0]);

  // remove old from cloudinary
  // await cloudinary.uploader.destroy(oldPublicId);

  // return uploaded
  // return uploaded;
};

export default handleUpdateFile;
