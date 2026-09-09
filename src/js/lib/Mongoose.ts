import type mongoose from "mongoose";

// ─────────────────────────────────────────────
// String
// ─────────────────────────────────────────────

export interface StringField {
  type: StringConstructor;

  required?: boolean;

  unique?: boolean;

  index?: boolean;

  trim?: boolean;

  lowercase?: boolean;

  default?: string;

  enum?: readonly string[];

  minlength?: number;

  select?: boolean;
}

// ─────────────────────────────────────────────
// Number
// ─────────────────────────────────────────────

export interface NumberField {
  type: NumberConstructor;

  required?: boolean;

  unique?: boolean;

  index?: boolean;

  default?: number;

  min?: number;

  max?: number | [number, string];

  select?: boolean;
}

// ─────────────────────────────────────────────
// Boolean
// ─────────────────────────────────────────────

export interface BooleanField {
  type: BooleanConstructor;

  required?: boolean;

  unique?: boolean;

  index?: boolean;

  default?: boolean;

  select?: boolean;
}

// ─────────────────────────────────────────────
// Date
// ─────────────────────────────────────────────

export interface DateField {
  type: DateConstructor;

  required?: boolean;

  unique?: boolean;

  index?: boolean;

  default?: typeof Date.now | Date;

  min?: Date;

  max?: Date;

  select?: boolean;
}

// ─────────────────────────────────────────────
// String Array
// ─────────────────────────────────────────────

export interface StringArrayField {
  type: [StringConstructor];

  required?: boolean;

  index?: boolean;

  default?: string[];

  select?: boolean;
}

// ─────────────────────────────────────────────
// Object Array
// ─────────────────────────────────────────────

export interface ObjectArrayField {
  type: [ObjectConstructor];

  required?: boolean;

  index?: boolean;

  default?: object[] | (() => object[]);

  select?: boolean;
}

// ─────────────────────────────────────────────
// ObjectId
// ─────────────────────────────────────────────

export interface ObjectIdField {
  type: typeof mongoose.Schema.Types.ObjectId;

  required?: boolean;

  unique?: boolean;

  index?: boolean;

  ref?: string;

  select?: boolean;
}

// ─────────────────────────────────────────────
// Encrypted String
// ─────────────────────────────────────────────

export interface EncryptedString {
  str: StringField;

  nonce: StringField;

  publicKey: StringField;

  securedPrivateKey: StringField;
}

// ─────────────────────────────────────────────
// File Metadata
// ─────────────────────────────────────────────

export interface FileMetaDataField {
  storageKey: StringField;

  url: StringField;

  bytes?: NumberField;

  format?: StringField;

  mimeType?: StringField;

  resourceType?: StringField;

  width?: NumberField;

  height?: NumberField;
}