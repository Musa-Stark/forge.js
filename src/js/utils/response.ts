import type { Response } from "express";

export interface AppResponse {
  res: Response;
  data?: unknown;
  message: string;
  statusCode?: number;
  accessToken?: string | undefined
  refreshToken?: string | undefined
  purpose?: string
}

const appResponse = ({
  res,
  data = undefined,
  message,
  statusCode = 200,
  accessToken,
  refreshToken,
  purpose
}: AppResponse): void => {
  res.status(statusCode).json({
    success: true,
    data,
    message,
    accessToken,
    refreshToken,
    purpose
  });
};

export default appResponse;
