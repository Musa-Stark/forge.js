import AppLog from "../utils/AppLog.js";
import type { NextFunction, Request, Response } from "express";
import type { AppErrorConstructor } from "../utils/AppError.ts";

const errorMiddleware = (
  err: AppErrorConstructor,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const message = err.message || "Internal Server Error";
  const statusCode = err.statusCode || 500;
  const data = err.data;

  AppLog("x", "error.middleware", message);

  if (err.isOperational) {
    return res.status(statusCode).json({ success: false, message, data });
  }

  if (err instanceof SyntaxError && "body" in err) {
    AppLog("x", "error.middleware", "Invalid JSON in request body.");

    return res.status(400).json({
      success: false,
      message: "Invalid JSON in request body.",
    });
  }

  console.error(err);

  res.status(500).json({ success: false, message: "Something went wrong" });
};

export default errorMiddleware;
