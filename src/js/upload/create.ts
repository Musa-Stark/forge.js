import streamifier from "streamifier";
import AppError from "../utils/AppError.js";
import type { StoreFile } from "../types/StoreFile.js";
import { cloudinary, setupCloudinary } from "../config/cloudinary.js";
import type { Route } from "../types/Collection.js";
import type { Request } from "express";
import getErrorDetail from "../utils/getErrorDetail.js";


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
      (error, result) => {
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

export const handleUploadFiles = async (req: Request, route: Route) => {
  // if fileArray = undefined, [], false, length = 0
  if (!route?.fileArray?.length) return;

  // if mongooseSchemaFieldName is missing
  for (const el of route.fileArray) {
    if (!el.mongooseSchemaFieldName)
      throw new AppError({
        message: "mongooseSchemaFieldName is required.",
        statusCode: 400,
        code: "UPLOAD_MONGOOSE_FIELD_REQUIRED",
        hint:
          "Provide mongooseSchemaFieldName in collection -> fileArray configuration.",
        details: getErrorDetail(route),
      });
  }

  // if files not found
  if (!Object.keys(req.files ?? {}).length)
    throw new AppError({
      message: "File is required.",
      statusCode: 400,
      code: "UPLOAD_FILE_REQUIRED",
      hint: "Upload at least one file using the configured upload field.",
      details: {
        handler: route.handler,
        method: route.method,
        path: route.path,
      },
    });

  const files = Object.values(req.files!).flat();

  const metaData = await Promise.all(files.map((file) => uploadFile(file, route)));
  const mongooseFieldName = route.fileArray[0]!.mongooseSchemaFieldName;

  return { [mongooseFieldName as string]: metaData };
};

export default handleUploadFiles;