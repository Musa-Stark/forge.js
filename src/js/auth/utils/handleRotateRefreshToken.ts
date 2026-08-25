import getModel from "../../utils/getModel.js";
import { sendCookie } from "./sendCookie.js";
import { getEnvs } from "../../config/envs.js";
import type { Response } from "express";
import type { Route } from "../../types/Collection.js";
import { hash } from "../../utils/libsodium.js";
import saveRefreshToken from "../../utils/saveRefreshToken.js";

export interface ROTATE_REFRESH_TOKEN {
  owner: string;
  jti: string;
  deviceType: string;
  familyId: string;
  res: Response;
  routeObj: Route;
  deviceName: string;
  ipAddress: string;
  os: string;
}

const handleRotateRefreshToken = async ({
  owner,
  jti,
  deviceType,
  familyId,
  res,
  routeObj,
  deviceName,
  ipAddress,
  os,
}: ROTATE_REFRESH_TOKEN) => {
  const RefreshToken = getModel({ modelName: "RefreshToken" });
  const { authConfigObj } = getEnvs();

  let REFRESH_TOKEN = null;

  if (!authConfigObj.rotateRefreshToken) {
    // update lastUsed
    await RefreshToken.updateOne(
      {
        owner,
        jti,
        revoked: false,
      },
      { $set: { lastUsedAt: Date.now() } },
    );
  } else {
    // cookie
    const { refreshToken, refreshTokenAge } = sendCookie({
      deviceType,
      refreshTokenName: authConfigObj.refreshTokenName!,
      jti,
      familyId,
      refreshTokenPayload: {
        sub: owner,
      },
      res,
      routeObj,
    });

    REFRESH_TOKEN = refreshToken;

    // hashedToken
    const hashedToken = await hash(refreshToken!);

    // check if old token
    await RefreshToken.updateMany(
      {
        owner,
        refreshTokenHash: { $ne: hashedToken },
        familyId,
        revoked: false,
      },
      { $set: { revoked: true } },
    );

    await saveRefreshToken({
      _id: owner,
      familyId,
      jti,
      hashedToken,
      refreshTokenAge,
      routeObj,
      deviceName,
      deviceType,
      ipAddress,
      os,
    });
  }

  return REFRESH_TOKEN;
};

export default handleRotateRefreshToken;
