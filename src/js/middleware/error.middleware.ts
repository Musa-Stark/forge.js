import AppLog from "../utils/AppLog.js";
import type { NextFunction, Request, Response } from "express";
import type { AppErrorConstructor } from "../utils/AppError.ts";

const errorMiddleware = (
  err: AppErrorConstructor,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const message = err.message || "Internal Server Error";
  const statusCode = err.statusCode || 500;

  AppLog("x", "error.middleware", message);

  if (err.isOperational) {
    return res.status(statusCode).json({ success: false, message });
  }

  console.error(err);

  res.status(500).json({ success: false, message: "Something went wrong" });
};

export default errorMiddleware;
