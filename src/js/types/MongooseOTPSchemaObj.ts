import type { MongooseField } from "../lib/mongoose.fields.js";

type OTPConfig = {
  maxOtpTries?: 5 | 7 | 10 | 15 | 20;
  otpExpiry?: "1m" | "3m" | "5m" | "10m" | "15m" | "20m";
};

export type OTPSchema = OTPConfig | {
  [key: string]: MongooseField;
};
