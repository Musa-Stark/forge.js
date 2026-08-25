import createModel from "../lib/model.factory.js";
import mongoose from "mongoose";
import registerModel from "../lib/model.registry.js";

const NullString = {
  type: String,
  default: null,
};

const refreshModelDefinition = {
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  refreshTokenHash: {
    type: String,
    required: true,
  },

  familyId: {
    type: String,
    required: true,
    index: true,
  },

  jti: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  deviceType: NullString,

  deviceName: NullString,

  ipAddress: NullString,

  os: NullString,

  browser: NullString,

  lastUsedAt: {
    type: Date,
    default: Date.now,
  },

  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },

  revoked: {
    type: Boolean,
    default: false,
    index: true,
  },
};

// create refresh model
const createRefreshModel = async () =>
  (registerModel["RefreshToken"] = createModel(
    "RefreshToken",
    refreshModelDefinition,
  ));

export default createRefreshModel;
