import { z } from "zod";
import "dotenv/config";

/**
 * =========================
 * STRING HELPERS
 * =========================
 */

export const requiredString = z
  .string()
  .trim()
  .min(1, "At least 1 character in string is required");

export const optionalString = z.string().trim().default("");

/**
 * =========================
 * EMAIL
 * =========================
 */

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email address");

/**
 * =========================
 * PASSWORD
 * =========================
 */

export const password = z
  .string()
  .min(6, "Password must be at least 6 characters");

/**
 * =========================
 * NUMBER HELPERS
 * =========================
 */

export const requiredNumber = z.coerce
  .number()
  .min(0.1, "Number must be 0.1 or greater");

export const optionalNumber = z.coerce.number().default(0);

/**
 * =========================
 * BOOLEAN HELPERS
 * =========================
 */

export const booleanTrue = z.boolean().default(true);
export const booleanFalse = z.boolean().default(false);

/**
 * =========================
 * DATE
 * =========================
 */

export const dateNow = z.date().default(() => new Date());

/**
 * =========================
 * ARRAYS
 * =========================
 */

export const stringArray = z.preprocess((val) => {
  if (Array.isArray(val)) return val;

  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      return val.split(",").map((v) => v.trim());
    }
  }

  return [];
}, z.array(z.string()).default([]));

export const requiredStringArray = z.preprocess(
  (val) => {
    if (val === undefined || val === null) return undefined;

    if (Array.isArray(val)) return val;

    if (typeof val === "string") {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return val.split(",").map((v) => v.trim());
      }
    }

    return val;
  },
  z.array(z.string()).min(1, "Array must have at least 1 element"),
);

export const objectArray = z.preprocess(
  (val) => {
    if (Array.isArray(val)) return val;

    if (typeof val === "string") {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        return [];
      }
    }

    return [];
  },
  z.array(z.object({})).default([]),
);

export const requiredObjectArray = (objSchema: z.ZodTypeAny, arrayName = "") =>
  z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;

      if (Array.isArray(val)) return val;

      if (typeof val === "string") {
        try {
          const parsed = JSON.parse(val);
          return Array.isArray(parsed) ? parsed : val;
        } catch {
          return val;
        }
      }

      return val;
    },
    z.array(objSchema).min(1, `${arrayName} array is required`),
  );

/**
 * =========================
 * OBJECT ID / REFERENCES
 * =========================
 */

export const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

export const requiredObjectId = objectId;

export const userRef = objectId;
export const requiredUserRef = objectId;

export const userRefArray = z.array(objectId).default([]);

/**
 * =========================
 * ENUMS
 * =========================
 */

export const provider = z.enum(["local", "google"]).default("local");

/**
 * =========================
 * TIMESTAMPS
 * =========================
 */

export const timestamps = {
  createdAt: dateNow,
  updatedAt: dateNow,
};

// files
const requiredImage = z
  .object({
    fieldname: z.string(),
    originalname: z.string(),
    mimetype: z.string(),
    size: z.number(),
  })
  .passthrough()
  .refine((file) => file.mimetype.startsWith("image/"), {
    message: "Only image files are allowed",
  });

const object = (shape: Record<string, z.ZodTypeAny>) => {
  return z.object(shape);
};

/**
 * =========================
 * EXPORT ALL
 * =========================
 */
export const zodValidations = {
  requiredString,
  optionalString,
  email,
  password,
  requiredNumber,
  optionalNumber,
  booleanTrue,
  booleanFalse,
  dateNow,
  stringArray,
  requiredStringArray,
  objectArray,
  requiredObjectArray,
  objectId,
  requiredObjectId,
  userRef,
  requiredUserRef,
  userRefArray,
  timestamps,
  provider,
  requiredImage,
  object,
} as const;

export default zodValidations;

type OnlyZodSchemas<T> = {
  [K in keyof T as T[K] extends z.ZodTypeAny ? K : never]: T[K];
};

export type ZodValidation = OnlyZodSchemas<
  typeof zodValidations
>[keyof OnlyZodSchemas<typeof zodValidations>];
