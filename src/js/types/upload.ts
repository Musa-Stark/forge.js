export interface Upload {
  fieldName: string;
  mongooseSchemaFieldName: String;
  type: "image" | "video" | "raw";
  provider: "cloudinary" | "aws-s3";
  multiple?: boolean;
  identifierKey?: string;
}
