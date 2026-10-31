/** Metadata about a file persisted in a storage provider. */
export interface StoreFile {
  url: string;
  storageKey: string;
  width?: number | undefined;
  height?: number | undefined;
  bytes: number;
  format: string;
  mimeType?: string | undefined;
  resourceType: string;
}
