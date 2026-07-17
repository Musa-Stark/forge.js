import streamifier from "streamifier";
import AppError from "../utils/AppError.js";
import type { StoreFile } from "../types/StoreFile.js";
import { cloudinary, setupCloudinary } from "../config/cloudinary.js";
import type { Route } from "../types/Collection.js";
import type { Request } from "express";

const uploadFile = (file: Express.Multer.File): Promise<StoreFile> => {
  setupCloudinary();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "framework",
      },
      (error, result) => {
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
export const handleUploadFiles = async (req: Request, route: Route) => {
  // if uploadArray = undefined, [], false, length = 0
  if (!route?.uploadArray?.length) return;

  // if mongooseFieldName is missing
  for (const el of route.uploadArray) {
    if (!el.mongooseSchemaFieldName)
      throw new AppError({
        message: `mongooseSchemaFieldName is missing in handler: '${route.handler}', method: '${route.method}', path: '${route.path}'`,
        statusCode: 400,
      });
  }

  // if files not found
  if (!Object.keys(req.files ?? {}).length)
    throw new AppError({
      message: `Files are required for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to upload`,
      statusCode: 400,
    });

  const files = Object.values(req.files!).flat();

  const metaData = await Promise.all(files.map(uploadFile));
  const mongooseFieldName = route.uploadArray[0]!.mongooseSchemaFieldName;

  return { [mongooseFieldName as string]: metaData };
};

export default handleUploadFiles;
