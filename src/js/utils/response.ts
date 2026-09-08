import type { Response } from "express";
import { getEnvs } from "../config/envs.js";

export interface AppResponse {
  res: Response;
  data?: unknown;
  message: string;
  statusCode?: number;
  accessToken?: string | undefined;
  refreshToken?: string | undefined;
  purpose?: string;
}

const appResponse = ({
  res,
  data = undefined,
  message,
  statusCode = 200,
  accessToken,
  refreshToken,
  purpose,
}: AppResponse): void => {
  const { authConfig } = getEnvs();

  res.status(statusCode).json({
    success: true,
    data,
    message,
    [authConfig.accessTokenName ?? "accessToken"]: accessToken,
    [authConfig.refreshTokenName ?? "refreshToken"]: refreshToken,
    purpose,
  });
};

export default appResponse;
