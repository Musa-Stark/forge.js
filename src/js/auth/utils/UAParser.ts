import { UAParser } from "ua-parser-js";
import type { Request } from "express";
import crypto from "crypto";

const tokenInfo = (req: Request) => {
  const parser = new UAParser(req.get("user-agent"));
  const result = parser.getResult();

  return {
    deviceType: result.device.type || "desktop",
    deviceName: result.device.model || undefined,
    ipAddress: req.ip || undefined,
    os: `${result.os.name} ${result.os.version || ""}`,
    jti: crypto.randomBytes(16).toString("hex"),
    familyId: crypto.randomBytes(16).toString("hex"),
    reqMethod: req.method
  };
};

export default tokenInfo;
