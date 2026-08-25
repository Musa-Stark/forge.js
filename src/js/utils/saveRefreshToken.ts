import { UAParser } from "ua-parser-js";
import type { Request } from "express";
import { hash } from "./libsodium.js";
import type { DurationType } from "../config/duration.js";
import registerModel from "../lib/model.registry.js";
import getDuration from "../config/duration.js";
import type { Route } from "../types/Collection.js";
import getModel from "./getModel.js";

export interface RefreshToken {
  hashedToken: string;
  refreshTokenAge: DurationType | undefined;
  _id: string;
  routeObj: Route;
  jti: string;
  familyId: string;
  deviceType: string;
  deviceName: string | undefined;
  ipAddress: string | undefined,
  os: string;
}

const saveRefreshToken = async ({
  hashedToken,
  refreshTokenAge,
  _id,
  routeObj,
  jti,
  familyId,
  deviceName,
  deviceType,
  ipAddress,
  os
}: RefreshToken) => {
  const RefreshToken = await getModel({modelName: "RefreshToken"})

  // create token
  await RefreshToken.create({
    owner: _id,
    refreshTokenHash: hashedToken,
    jti,
    deviceType,
    familyId,
    deviceName,
    ipAddress,
    os,
    expiresAt: Date.now() + getDuration(refreshTokenAge!, routeObj),
  });
};
export default saveRefreshToken;
