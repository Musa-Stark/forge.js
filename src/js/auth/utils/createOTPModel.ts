import createModel from "../../lib/model.factory.js";
import type { OTPSchema } from "../../types/MongooseOTPSchemaObj.js";
import otpPurposes from "../../utils/otpPurposes.js";

const createOTPModel = (routeName: string, mongooseSchemaObj: OTPSchema) => {
  // Make all fields from the original schema optional
  const optionalSchema = Object.fromEntries(
    Object.entries(mongooseSchemaObj).map(([key, value]) => [
      key,
      {
        ...value,
        required: false,
        unique: false,
      },
    ]),
  ) as OTPSchema;

  return createModel(routeName, "otpUser", {
    ...optionalSchema,

    otpCount: { type: Number, default: 0 },
    OTP: { type: String },
    otpExpiry: { type: Date },
    isVerified: { type: Boolean, default: false },
    maxOTPTries: { type: Number, default: 10 },
    purpose: {
      type: String,
      enum: otpPurposes,
      required: true,
    },
  });
};

export default createOTPModel;
