import type mongoose from "mongoose";

export interface StringField {
  type: StringConstructor;
  required?: boolean;
  unique?: boolean;
  trim?: boolean;
  lowercase?: boolean;
  default?: string;
  enum?: readonly string[];
  minlength?: number;
  select?: boolean;
}

export interface NumberField {
  type: NumberConstructor;
  required?: boolean;
  default?: number;
  min?: number;
  max?: number | [number, string];
}

export interface BooleanField {
  type: BooleanConstructor;
  required?: boolean;
  default?: boolean;
}

export interface DateField {
  type: DateConstructor;
  required?: boolean;
  default?: typeof Date.now | Date;
}

export interface StringArrayField {
  type: [StringConstructor];
  default?: string[];
}

export interface ObjectArrayField {
  type: [ObjectConstructor];
  default?: object[] | (() => object[]);
}

export interface ObjectIdField {
  type: typeof mongoose.Schema.Types.ObjectId;
  required?: boolean;
  ref?: string;
}

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