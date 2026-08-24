import createModel from "../lib/model.factory.js";
import mongoose from "mongoose";

const RequiredString = {
  type: String,
  required: true,
};

const refreshModelDefinition = {
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  refreshTokenHash: RequiredString,

  deviceType: RequiredString,

  deviceName: RequiredString,

  ipAddress: RequiredString,

  os: RequiredString,

  browser: RequiredString,

  lastUsedAt: {
    type: Date,
    default: Date.now,
  },

  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },

  revoked: {
    type: Boolean,
    default: false,
    index: true,
  },
};

const createRefreshModel = async () =>
  createModel("RefreshToken", refreshModelDefinition);

export default createRefreshModel;
