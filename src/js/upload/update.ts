import streamifier from "streamifier";
import AppError from "../utils/AppError.js";
import { cloudinary, setupCloudinary } from "../config/cloudinary.js";
import type { StoreFile } from "../types/StoreFile.js";
import type { Route } from "../types/Collection.ts";
import type { Request } from "express";

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
  file: Express.Multer.File,
  oldPublicId: string,
): Promise<StoreFile> => {
  const uploaded = await uploadFile(file);

  await cloudinary.uploader.destroy(oldPublicId);

  return uploaded;
};

export default handleUpdateFile;

const updateFile = async (req: Request, route: Route) => {
  // if uploadArray = undefined, [], false, length = 0
  if (!route?.uploadArray?.length) return;

  // if files not found
  if (!Object.keys(req.files!).length)
    throw new AppError({
      message: `Files are required for handler: '${route.handler}', method: '${route.method}' and path: '${route.path}' to update`,
      statusCode: 400,
    });

  const files = Object.values(req.files!).flat();

  return await Promise.all(files.map(uploadFile));
};
