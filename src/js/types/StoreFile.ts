export interface StoreFile {
  url: string;
  storageKey: string;
  width?: number;
  height?: number;
  bytes: number;
  format: string;
  resourceType: string;
}