import type { Response } from "express";

export interface AppResponse {
  res: Response;
  data?: unknown;
  message: string;
  statusCode?: number;
}

const appResponse = ({
  res,
  data,
  message,
  statusCode = 200,
}: AppResponse): void => {
  res.status(statusCode).json({
    success: true,
    data,
    message,
  });
};

export default appResponse;
