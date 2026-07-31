import createModel from "../../lib/model.factory.js";
import type { OTPSchema } from "../../types/MongooseOTPSchemaObj.js";
import otpPurposes from "../../utils/otpPurposes.js";

const createOTPModel = (routeName: string, mongooseSchemaObj: OTPSchema) => {
  // Make all fields from the original schema optional
  const makeOptional = (field: any): any => {
    // Array schema
    if (Array.isArray(field)) {
      return field.map(makeOptional);
    }

    // Nested object that contains `type`
    if (field && typeof field === "object" && "type" in field) {
      return {
        ...field,
        required: false,
        unique: false,
      };
    }

    // Nested schema object
    if (field && typeof field === "object") {
      return Object.fromEntries(
        Object.entries(field).map(([k, v]) => [k, makeOptional(v)]),
      );
    }

    return field;
  };

  const optionalSchema = makeOptional(mongooseSchemaObj);

  return createModel(routeName, "otpUser", {
    ...optionalSchema,

    otpCount: { type: Number, default: 0 },
    OTP: { type: String },
    otpExpiry: { type: Date },
    isVerified: { type: Boolean, default: false },
    maxOTPTries: { type: Number, default: 10 },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    purpose: {
      type: String,
      enum: otpPurposes,
      required: true,
    },
  });
};

export default createOTPModel;
