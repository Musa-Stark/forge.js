export interface StoreFile {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  bytes: number;
  format: string;
  resourceType: string;
}