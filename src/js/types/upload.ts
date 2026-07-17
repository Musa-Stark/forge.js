export interface Upload {
  fieldName: string;
  type: "image" | "video" | "raw";
  provider: "cloudinary" | "aws-s3";
  multiple?: boolean;
}
