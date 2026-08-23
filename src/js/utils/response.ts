import type { Response } from "express";

export interface AppResponse {
  res: Response;
  data?: unknown;
  message: string;
  statusCode?: number;
  accessToken?: string | undefined
}

const appResponse = ({
  res,
  data = undefined,
  message,
  statusCode = 200,
  accessToken
}: AppResponse): void => {
  res.status(statusCode).json({
    success: true,
    data,
    message,
    accessToken
  });
};

export default appResponse;
