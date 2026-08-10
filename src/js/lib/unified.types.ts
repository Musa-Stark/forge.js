// types/Field.ts
import type { z } from "zod";
import type {
  StringField,
  NumberField,
  BooleanField,
  DateField,
  StringArrayField,
  ObjectArrayField,
  ObjectIdField,
  EncryptedString,
  FileMetaDataField,
} from "./Mongoose.js";

export type UnifiedField =
  | {
      mongoose:
        | StringField
        | NumberField
        | BooleanField
        | DateField
        | ObjectIdField
        | any;
      zod: z.ZodTypeAny;
    }
  | {
      mongoose:
        | StringArrayField
        | ObjectArrayField
        | FileMetaDataField[]
        | EncryptedString
        | any;
      zod: z.ZodTypeAny;
    };
