/** Supported storage provider destinations for file uploads. */
export type UploadProvider = "cloudinary" | "aws-s3";

/** File category used for validation and storage. */
export type UploadType = "image" | "video" | "raw";

/**
 * Configuration for handling file uploads on a route.
 *
 * @example
 * ```ts
 * { paramField: "avatar", schemaField: "profileImage", type: "image", provider: "cloudinary" }
 * ```
 */
export interface Upload {
  /** Field name expected in the incoming multipart form. */
  paramField: string;

  /** Schema field where the file metadata is saved. */
  schemaField: string;

  /** Type of file allowed. Defaults to `"image"`. */
  type?: UploadType;

  /** Storage provider. Defaults to `"cloudinary"`. */
  provider?: UploadProvider;

  /** Allow several files for this field. @default false */
  multiple?: boolean;

  /**
   * Request-body key that carries the id of the stored file to update/delete
   * (used by `updateFile` and `deleteFile`).
   */
  validationKey?: string;

  /** Override the allowed mime types (mainly useful for `type: "raw"`). */
  allowedMimeTypes?: string[];
}

/** @deprecated Use {@link Upload}. */
export type LegacyUpload = Upload;
