import type { ZodValidation } from "../lib/zod.fields.js";

export type ValidationsObj = {
  status: "pending" | "accepted" | "rejected";
} & {
  [key: string]: ZodValidation;
};
