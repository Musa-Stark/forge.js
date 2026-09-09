import mongoose from "mongoose";

import { ROLES, type Role } from "./roles.js";

import type {
  BooleanField,
  DateField,
  EncryptedString,
  FileMetaDataField,
  NumberField,
  ObjectArrayField,
  ObjectIdField,
  StringArrayField,
  StringField,
} from "./Mongoose.js";

import { OAUTH_PROVIDERS } from "./OAuthProviders.js";

const { ObjectId } = mongoose.Schema.Types;

// ─────────────────────────────────────────────
// String Fields
// ─────────────────────────────────────────────

const requiredString: StringField = {
  type: String,
  required: true,
  trim: true,
};

const optionalString: StringField = {
  type: String,
  trim: true,
};

const optionalEmptyString: StringField = {
  type: String,
  default: "",
  trim: true,
};

const requiredIndexString: StringField = {
  type: String,
  required: true,
  index: true,
  trim: true,
};

const optionalIndexString: StringField = {
  type: String,
  index: true,
  trim: true,
};

const optionalEmptyIndexString: StringField = {
  type: String,
  default: "",
  index: true,
  trim: true,
};

const requiredUniqueString: StringField = {
  type: String,
  required: true,
  unique: true,
  trim: true,
};

const email: StringField = {
  type: String,
  required: true,
  unique: true,
  lowercase: true,
  trim: true,
};

const password: StringField = {
  type: String,
  required: true,
  minlength: 6,
};

// ─────────────────────────────────────────────
// Number Fields
// ─────────────────────────────────────────────

const requiredNumber: NumberField = {
  type: Number,
  required: true,
};

const optionalNumber: NumberField = {
  type: Number,
  default: 0,
};

const requiredIndexNumber: NumberField = {
  type: Number,
  required: true,
  index: true,
};

const optionalIndexNumber: NumberField = {
  type: Number,
  default: 0,
  index: true,
};

// ─────────────────────────────────────────────
// Boolean Fields
// ─────────────────────────────────────────────

const boolean: BooleanField = {
  type: Boolean,
};

const booleanTrue: BooleanField = {
  type: Boolean,
  default: true,
};

const booleanFalse: BooleanField = {
  type: Boolean,
  default: false,
};

// ─────────────────────────────────────────────
// Date Fields
// ─────────────────────────────────────────────

const dateNow: DateField = {
  type: Date,
  default: Date.now,
};

const indexDateNow: DateField = {
  type: Date,
  default: Date.now,
  index: true,
};

// ─────────────────────────────────────────────
// Array Fields
// ─────────────────────────────────────────────

const stringArray: StringArrayField = {
  type: [String],
  default: [],
};

const objectArray: ObjectArrayField = {
  type: [Object],
  default: () => [{}],
};

// ─────────────────────────────────────────────
// ObjectId Fields
// ─────────────────────────────────────────────

const objectId: ObjectIdField = {
  type: ObjectId,
};

const requiredObjectId: ObjectIdField = {
  type: ObjectId,
  required: true,
};

const indexObjectId: ObjectIdField = {
  type: ObjectId,
  index: true,
};

const requiredIndexObjectId: ObjectIdField = {
  type: ObjectId,
  required: true,
  index: true,
};

const userRef: ObjectIdField = {
  type: ObjectId,
  ref: "User",
};

const requiredUserRef: ObjectIdField = {
  type: ObjectId,
  ref: "User",
  required: true,
};

const userRefArray = [
  {
    type: ObjectId,
    ref: "User",
  },
] as const;

/*
const customRef = (model: string): ObjectIdField => ({
  type: ObjectId,
  ref: model,
});

const customRequiredRef = (model: string): ObjectIdField => ({
  type: ObjectId,
  ref: model,
  required: true,
});

const customRefArray = (model: string) =>
  [
    {
      type: ObjectId,
      ref: model,
    },
  ] as const;
*/

// ─────────────────────────────────────────────
// Timestamps
// ─────────────────────────────────────────────

const timestamps = {
  createdAt: dateNow,
  updatedAt: dateNow,
};

// ─────────────────────────────────────────────
// Authentication / User Fields
// ─────────────────────────────────────────────

const provider: StringField = {
  type: String,
  enum: OAUTH_PROVIDERS,
  default: "local",
};

const role: StringField = {
  type: String,
  required: true,
  trim: true,
  enum: ROLES,
  default: "user",
};

const otp: StringField = {
  type: String,
  required: true,
};

const otpExpiry: NumberField = {
  type: Number,
  required: true,
};

const otpCount: NumberField = {
  type: Number,
  required: true,
  default: 0,
  max: [10, "OTP verification limit reached. Please try again later."],
};

const otpStatus: StringField = {
  type: String,
  enum: ["pending", "verified", "blocked"],
  default: "pending",
};

const recruitmentStatus: StringField = {
  type: String,
  enum: ["new", "reviewing", "accepted", "rejected"],
  default: "new",
};

// ─────────────────────────────────────────────
// Encrypted Fields
// ─────────────────────────────────────────────

const encryptedString: EncryptedString = {
  str: {
    type: String,
    required: true,
  },

  nonce: {
    type: String,
    required: true,
  },

  publicKey: {
    type: String,
    required: true,
  },

  securedPrivateKey: {
    type: String,
    required: true,
  },
};

// ─────────────────────────────────────────────
// File Metadata
// ─────────────────────────────────────────────

const requiredFileMetaData: FileMetaDataField[] = [
  {
    storageKey: {
      type: String,
      required: true,
    },

    url: {
      type: String,
      required: true,
    },

    bytes: {
      type: Number,
    },

    format: {
      type: String,
    },

    mimeType: {
      type: String,
    },

    resourceType: {
      type: String,
    },

    width: {
      type: Number,
    },

    height: {
      type: Number,
    },
  },
];

const optionalFileMetaData: FileMetaDataField[] = [
  {
    storageKey: {
      type: String,
    },

    url: {
      type: String,
    },

    bytes: {
      type: Number,
    },

    format: {
      type: String,
    },

    mimeType: {
      type: String,
    },

    resourceType: {
      type: String,
    },

    width: {
      type: Number,
    },

    height: {
      type: Number,
    },
  },
];

const optionalEmptyFileMetaData: FileMetaDataField[] = [
  {
    storageKey: {
      type: String,
      default: "",
    },

    url: {
      type: String,
      default: "",
    },

    bytes: {
      type: Number,
    },

    format: {
      type: String,
    },

    mimeType: {
      type: String,
    },

    resourceType: {
      type: String,
    },

    width: {
      type: Number,
    },

    height: {
      type: Number,
    },
  },
];

// ─────────────────────────────────────────────
// Exported Mongoose Fields
// ─────────────────────────────────────────────

const mongooseFields = {
  // Strings
  requiredString,
  optionalString,
  optionalEmptyString,
  requiredIndexString,
  optionalIndexString,
  optionalEmptyIndexString,
  requiredUniqueString,
  email,
  password,

  // Numbers
  requiredNumber,
  optionalNumber,
  requiredIndexNumber,
  optionalIndexNumber,

  // Booleans
  boolean,
  booleanTrue,
  booleanFalse,

  // Dates
  dateNow,
  indexDateNow,

  // Arrays
  stringArray,
  objectArray,

  // ObjectIds
  objectId,
  requiredObjectId,
  indexObjectId,
  requiredIndexObjectId,
  userRef,
  requiredUserRef,
  userRefArray,

  // Common
  timestamps,

  // Auth
  provider,
  role,
  otp,
  otpExpiry,
  otpCount,
  otpStatus,
  recruitmentStatus,

  // Files
  requiredFileMetaData,
  optionalFileMetaData,
  optionalEmptyFileMetaData,

  // Encryption
  encryptedString,
} as const;

export type MongooseField =
  (typeof mongooseFields)[keyof typeof mongooseFields];

export default mongooseFields;
