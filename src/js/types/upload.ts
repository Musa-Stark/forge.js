/**
 * Supported storage provider destinations for file uploads.
 */
export type UploadProvider = "cloudinary" | "aws-s3";

/**
 * File category type for validation and handling.
 */
export type UploadType = "image" | "video" | "raw";

/**
 * Configuration for handling file uploads on a route.
 * 
 * @example
 * ```ts
 * {
 *   paramField: "avatar",
 *   schemaField: "profileImage",
 *   type: "image",
 *   provider: "cloudinary",
 * }
 * ```
 */
export interface Upload {
  /**
   * Field name expected in the incoming multipart form request payload.
   * 
   * @example "avatar"
   */
  paramField: string;

  /**
   * Database schema field name where file metadata will be saved.
   * 
   * @example "profileImage"
   */
  schemaField: string;

  /**
   * Type of file allowed for this upload.
   * 
   * @example "image"
   */
  type: UploadType;

  /**
   * Storage provider destination for uploading the file.
   * 
   * @example "cloudinary"
   */
  provider: UploadProvider;

  /**
   * Allow multiple file uploads for this field if set to `true`.
   * 
   * @default false
   */
  multiple?: boolean;

  /**
   * Optional custom validation key or identifier for file-specific rules.
   * 
   * @example "avatarRules"
   */
  validationKey?: string;
}

// Backward compatibility aliases
export type LegacyUpload = Upload;