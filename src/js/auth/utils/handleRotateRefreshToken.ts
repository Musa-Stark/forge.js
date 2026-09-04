import getModel from "../../utils/getModel.js";
import { sendCookie } from "./sendCookie.js";
import { getEnvs } from "../../config/envs.js";
import type { Response } from "express";
import type { Route } from "../../types/Collection.js";
import { hash } from "../../utils/libsodium.js";
import saveRefreshToken from "../../utils/saveRefreshToken.js";
import getDuration from "../../config/duration.js";

export interface ROTATE_REFRESH_TOKEN {
  owner: string;
  currentTokenJTI: string;
  rotateTokenJTI: string;
  deviceType: string;
  familyId: string;
  res: Response;
  routeObj: Route;
  deviceName: string;
  ipAddress: string;
  os: string;
  iat: number;
}

const handleRotateRefreshToken = async ({
  owner,
  currentTokenJTI,
  rotateTokenJTI,
  deviceType,
  familyId,
  res,
  routeObj,
  deviceName,
  ipAddress,
  os,
  iat,
}: ROTATE_REFRESH_TOKEN) => {
  const RefreshToken = getModel({ model: "RefreshToken" });
  const { authConfigObj } = getEnvs();

  const { refreshTokenName, rotateRefreshToken, refreshTokenRotationInterval } =
    authConfigObj;

  let REFRESH_TOKEN = null;

  // update - last used
  const updateLastUsed = async () => {
    await RefreshToken.updateOne(
      {
        owner,
        jti: currentTokenJTI,
        revoked: false,
      },
      { $set: { lastUsedAt: Date.now() } },
    );
  };

  if (!rotateRefreshToken) {
    // update lastUsed
    await updateLastUsed();
  } else {
    // check if rotationInterval is found
    const rotationInterval = getDuration(
      refreshTokenRotationInterval!,
      routeObj,
    );

    if (!!rotationInterval) {
      const timeLeft = iat * 1000 + rotationInterval;

      if (timeLeft > Date.now()) {
        await updateLastUsed();
        return;
      }
    }

    // cookie
    const { refreshToken, refreshTokenAge } = sendCookie({
      deviceType,
      refreshTokenName: refreshTokenName!,
      jti: rotateTokenJTI,
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
      jti: rotateTokenJTI,
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
