import type { NextFunction, Request, Response } from "express";

import { verifyJWT } from "../utils/handleJWT.js";
import AppError from "../utils/AppError.js";
import registerModel from "../lib/model.registry.js";
import { getEnvs } from "../config/envs.js";

const findUser = async (id: string) => {
  const { userModelName } = getEnvs();
  if (!userModelName)
    throw new AppError({
      message: "User Model is required for auth middleware",
      statusCode: 409,
    });

  const Model = registerModel[userModelName];

  return await Model?.findById(id);
};

const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = req.cookies?.authToken;

    if (!token) {
      return next(
        new AppError({
          message: "Authentication required",
          statusCode: 401,
        }),
      );
    }

    const payload = verifyJWT({ token });

    if (typeof payload === "string" || !payload.sub) {
      return next(
        new AppError({
          message: "Invalid token payload",
          statusCode: 401,
        }),
      );
    }

    const user = await findUser(payload.sub as string);

    if (!user) {
      return next(
        new AppError({
          message: "This account no longer exists",
          statusCode: 401,
        }),
      );
    }

    req.user = user;

    next();
  } catch (err) {
    next(
      new AppError({
        message: "Unauthorized",
        statusCode: 401,
      }),
    );
  }
};

export default protect;
