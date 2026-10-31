import { v2 as cloudinary } from "cloudinary";
import { ErrorCode, ServiceUnavailableError } from "../errors/index.js";
import type { StoreFile } from "../types/StoreFile.js";
import type { UploadType } from "../types/upload.js";
import type { IncomingFile, StorageProvider } from "./StorageProvider.js";

export interface CloudinaryOptions {
  apiKey: string;
  apiSecret: string;
  cloudName: string;
  folder: string;
}

export class CloudinaryStorage implements StorageProvider {
  readonly name = "cloudinary" as const;

  constructor(private readonly options: CloudinaryOptions) {
    // Configured once, not on every upload.
    cloudinary.config({
      cloud_name: options.cloudName,
      api_key: options.apiKey,
      api_secret: options.apiSecret,
      secure: true,
    });
  }

  upload(file: IncomingFile, { type }: { type: UploadType }): Promise<StoreFile> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: this.options.folder, resource_type: type, use_filename: false, unique_filename: true },
        (error, result) => {
          if (error || !result) {
            return reject(
              new ServiceUnavailableError({
                message: "The file could not be uploaded to storage.",
                code: ErrorCode.UPLOAD_FAILED,
                cause: error,
              }),
            );
          }
          resolve({
            url: result.secure_url,
            storageKey: result.public_id,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            format: result.format ?? "",
            mimeType: file.mimetype,
            resourceType: result.resource_type,
          });
        },
      );
      stream.end(file.buffer);
    });
  }

  async remove(file: Pick<StoreFile, "storageKey" | "resourceType">): Promise<void> {
    await cloudinary.uploader.destroy(file.storageKey, { resource_type: file.resourceType || "image", invalidate: true });
  }
}
