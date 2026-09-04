// fields.ts
import { z } from "zod";
import mongoose from "mongoose";
import { ROLES } from "./roles.js";
import { OAUTH_PROVIDERS } from "./OAuthProviders.js";
import otpPurposes from "../utils/otpPurposes.js";
import type { UnifiedField } from "./unified.types.ts";

const { ObjectId } = mongoose.Schema.Types;

/**
 * =========================
 * STRING FIELDS
 * =========================
 */
const requiredString: UnifiedField = {
  mongoose: {
    type: String,
    required: true,
    trim: true,
  },
  zod: z.string().trim().min(1, "At least 1 character is required"),
};

const optionalString: UnifiedField = {
  mongoose: {
    type: String,
    trim: true,
    default: "",
  },
  zod: z.string().trim().optional(),
};

const optionalEmptyString: UnifiedField = {
  mongoose: {
    type: String,
    default: "",
    trim: true,
  },
  zod: z.string().trim().default(""),
};

const requiredUniqueString: UnifiedField = {
  mongoose: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  zod: z.string().trim().min(1, "At least 1 character is required"),
};

const email: UnifiedField = {
  mongoose: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  zod: z.string().trim().toLowerCase().email("Invalid email address"),
};

const password: UnifiedField = {
  mongoose: {
    type: String,
    required: true,
    minlength: 6,
  },
  zod: z.string().min(6, "Password must be at least 6 characters"),
};

/**
 * =========================
 * NUMBER FIELDS
 * =========================
 */
const requiredNumber: UnifiedField = {
  mongoose: {
    type: Number,
    required: true,
  },
  zod: z.coerce.number().min(0.1, "Number must be 0.1 or greater"),
};

const optionalNumber: UnifiedField = {
  mongoose: {
    type: Number,
    default: 0,
  },
  zod: z.coerce.number().default(0),
};

/**
 * =========================
 * BOOLEAN FIELDS
 * =========================
 */
const boolean: UnifiedField = {
  mongoose: { type: Boolean },
  zod: z.boolean(),
};

const booleanTrue: UnifiedField = {
  mongoose: { type: Boolean, default: true },
  zod: z.boolean().default(true),
};

const booleanFalse: UnifiedField = {
  mongoose: { type: Boolean, default: false },
  zod: z.boolean().default(false),
};

/**
 * =========================
 * DATE FIELDS
 * =========================
 */
const dateNow: UnifiedField = {
  mongoose: {
    type: Date,
    default: Date.now,
  },
  zod: z.coerce.date().default(() => new Date()),
};

const requiredDate: UnifiedField = {
  mongoose: {
    type: Date,
    required: true,
  },
  zod: z.coerce.date(),
};

const optionalDate: UnifiedField = {
  mongoose: {
    type: Date,
  },
  zod: z.coerce.date().optional(),
};

/**
 * =========================
 * ARRAYS
 * =========================
 */
const stringArray: UnifiedField = {
  mongoose: {
    type: [String],
    default: [],
  },
  zod: z.preprocess((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return val.split(",").map((v) => v.trim());
      }
    }
    return [];
  }, z.array(z.string()).default([])),
};

const requiredStringArray: UnifiedField = {
  mongoose: {
    type: [String],
    required: true,
  },
  zod: z.preprocess(
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
  ),
};

const objectArray: UnifiedField = {
  mongoose: {
    type: [Object],
    default: () => [{}],
  },
  zod: z.preprocess(
    (val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === "string") {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          return [{}];
        }
      }
      return [{}];
    },
    z.array(z.object({})).default([{}]),
  ),
};

/**
 * =========================
 * OBJECT ID / REFERENCES
 * =========================
 */
const objectId: UnifiedField = {
  mongoose: { type: ObjectId },
  zod: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId"),
};

const requiredObjectId: UnifiedField = {
  mongoose: {
    type: ObjectId,
    required: true,
  },
  zod: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId"),
};

const userRef: UnifiedField = {
  mongoose: {
    type: ObjectId,
    ref: "User",
  },
  zod: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId"),
};

const requiredUserRef: UnifiedField = {
  mongoose: {
    type: ObjectId,
    ref: "User",
    required: true,
  },
  zod: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId"),
};

const userRefArray: UnifiedField = {
  mongoose: [
    {
      type: ObjectId,
      ref: "User",
    },
  ],
  zod: z
    .array(z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId"))
    .default([]),
};

/**
 * =========================
 * ENUMS & SPECIAL FIELDS
 * =========================
 */
const provider: UnifiedField = {
  mongoose: {
    type: String,
    enum: OAUTH_PROVIDERS,
    default: "local",
  },
  zod: z.enum(OAUTH_PROVIDERS).default("local"),
};

const role: UnifiedField = {
  mongoose: {
    type: String,
    required: true,
    trim: true,
    enum: ROLES,
    default: "user",
  },
  zod: z.enum(ROLES).default("user"),
};

const otp: UnifiedField = {
  mongoose: {
    type: String,
    required: true,
  },
  zod: z.string().min(4, "OTP is required"),
};

const otpExpiry: UnifiedField = {
  mongoose: {
    type: Number,
    required: true,
  },
  zod: z.coerce.number(),
};

const otpCount: UnifiedField = {
  mongoose: {
    type: Number,
    required: true,
    default: 0,
    max: [10, "OTP verification limit reached. Please try again later."],
  },
  zod: z.coerce.number().max(10),
};

const otpStatus: UnifiedField = {
  mongoose: {
    type: String,
    enum: ["pending", "verified", "blocked"],
    default: "pending",
  },
  zod: z.enum(["pending", "verified", "blocked"]).default("pending"),
};

const purposeOTP: UnifiedField = {
  mongoose: {
    type: String,
    enum: otpPurposes,
  },
  zod: z.enum(otpPurposes),
};

/**
 * =========================
 * TIMESTAMPS (special case)
 * =========================
 */
const timestamps = {
  createdAt: dateNow,
  updatedAt: dateNow,
};

/**
 * =========================
 * FILE METADATA
 * =========================
 */
const requiredFileMetaData: UnifiedField = {
  mongoose: [
    {
      storageKey: { type: String, required: true },
      url: { type: String, required: true },
      bytes: { type: Number },
      format: { type: String },
      mimeType: { type: String },
      resourceType: { type: String },
      width: { type: Number },
      height: { type: Number },
    },
  ],
  zod: z.array(
    z.object({
      storageKey: z.string(),
      url: z.string().url(),
      bytes: z.number().optional(),
      format: z.string().optional(),
      mimeType: z.string().optional(),
      resourceType: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    }),
  ),
};

const optionalFileMetaData: UnifiedField = {
  mongoose: [
    {
      storageKey: { type: String },
      url: { type: String },
      bytes: { type: Number },
      format: { type: String },
      mimeType: { type: String },
      resourceType: { type: String },
      width: { type: Number },
      height: { type: Number },
    },
  ],
  zod: z.array(
    z.object({
      storageKey: z.string().optional(),
      url: z.string().url().optional(),
      bytes: z.number().optional(),
      format: z.string().optional(),
      mimeType: z.string().optional(),
      resourceType: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    }),
  ).optional(),
};

const optionalEmptyFileMetaData: UnifiedField = {
  mongoose: [
    {
      storageKey: { type: String, default: "" },
      url: { type: String, default: "" },
      bytes: { type: Number },
      format: { type: String },
      mimeType: { type: String },
      resourceType: { type: String },
      width: { type: Number },
      height: { type: Number },
    },
  ],
  zod: z.array(
    z.object({
      storageKey: z.string().default(""),
      url: z.url().or(z.literal("")).default(""),
      bytes: z.number().optional(),
      format: z.string().optional(),
      mimeType: z.string().optional(),
      resourceType: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    }).optional(),
  ),
};

/**
 * =========================
 * ENCRYPTED STRING
 * =========================
 */
const encryptedString: UnifiedField = {
  mongoose: {
    str: { type: String, required: true },
    nonce: { type: String, required: true },
    publicKey: { type: String, required: true },
    securedPrivateKey: { type: String, required: true },
  },
  zod: z.object({
    str: z.string(),
    nonce: z.string(),
    publicKey: z.string(),
    securedPrivateKey: z.string(),
  }),
};

/**
 * =========================
 * EXPORT
 * =========================
 */
export const fields = {
  requiredString,
  optionalString,
  optionalEmptyString,
  requiredUniqueString,
  email,
  password,
  requiredNumber,
  optionalNumber,
  boolean,
  booleanTrue,
  booleanFalse,
  dateNow,
  requiredDate,
  optionalDate,
  stringArray,
  requiredStringArray,
  objectArray,
  objectId,
  requiredObjectId,
  userRef,
  requiredUserRef,
  userRefArray,
  provider,
  role,
  otp,
  otpExpiry,
  otpCount,
  otpStatus,
  purposeOTP,
  timestamps,
  encryptedString,
  requiredFileMetaData,
  optionalFileMetaData,
  optionalEmptyFileMetaData,
} as const;

export type FieldName = keyof typeof fields;
export type FieldDefinition = (typeof fields)[FieldName];

export default fields;
