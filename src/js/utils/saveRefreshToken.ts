import { UAParser } from "ua-parser-js";
import type { Request } from "express";
import { hash } from "./libsodium.js";
import type { DurationType } from "../config/duration.js";
import registerModel from "../lib/model.registry.js";
import getDuration from "../config/duration.js";
import type { Route } from "../types/Collection.js";

export interface RefreshToken {
  req: Request;
  refreshToken: string;
  refreshTokenAge: DurationType | undefined;
  _id: string;
  routeObj: Route;
}

const saveRefreshToken = async ({
  req,
  refreshToken,
  refreshTokenAge,
  _id,
  routeObj,
}: RefreshToken) => {
  // model
  const RefreshToken = registerModel["RefreshToken"];

  // info
  const parser = new UAParser(req.get("user-agent"));
  const result = parser.getResult();

  const hashedToken = await hash(refreshToken);

  await RefreshToken.create({
    owner: _id,
    refreshTokenHash: hashedToken,
    deviceType: result.device.type || "desktop",
    deviceName: result.device.model,
    ipAddress: req.ip,
    os: `${result.os.name} ${result.os.version || ""}`,
    expiresAt: getDuration(refreshTokenAge!, routeObj) || null,
  });
};
export default saveRefreshToken;
