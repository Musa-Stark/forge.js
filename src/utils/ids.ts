import { randomBytes } from "node:crypto";

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/** True for a 24-character hex string (the only form Forge accepts as a document id). */
export const isObjectId = (value: unknown): value is string =>
  typeof value === "string" && OBJECT_ID.test(value);

/** Generates a MongoDB-compatible ObjectId string without needing a driver. */
export const newObjectId = (): string => {
  const time = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
  return time + randomBytes(8).toString("hex");
};

/** Normalises an id-ish value (string, ObjectId, `{ _id }`) to a string. */
export const idToString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const v = value as { _id?: unknown; toHexString?: () => string };
    if (typeof v.toHexString === "function") return v.toHexString();
    if (v._id !== undefined && v._id !== value) return idToString(v._id);
  }
  return String(value);
};
