import type { StoreFile } from "../types/StoreFile.js";
import type { UploadProvider, UploadType } from "../types/upload.js";

export interface IncomingFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/** A place files are kept (Cloudinary, S3, disk...). */
export interface StorageProvider {
  readonly name: UploadProvider;
  upload(file: IncomingFile, options: { type: UploadType }): Promise<StoreFile>;
  remove(file: Pick<StoreFile, "storageKey" | "resourceType">): Promise<void>;
}
