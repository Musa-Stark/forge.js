import type { NextFunction, Request, Response } from "express";

import { verifyJWT } from "../utils/handleJWT.js";
import AppError from "../utils/AppError.js";
import registerModel from "../lib/model.registry.js";
import { getEnvs } from "../config/envs.js";
import getErrorDetail from "../utils/getErrorDetail.js";
import type { Route } from "../types/Collection.js";

const findUser = async (id: string, routeObj: Route) => {
  const { userModelName } = getEnvs();

  if (!userModelName) {
    throw new AppError({
      message: "User model is required for authentication",
      statusCode: 500,
      code: "AUTH_CONFIG_ERROR",
      hint: "Configure 'userModelName' in your environment variables.",
      details: getErrorDetail(routeObj),
    });
  }

  const Model = registerModel[userModelName as string];

  if (!Model) {
    throw new AppError({
      message: `User model '${userModelName}' is not registered`,
      statusCode: 500,
      code: "AUTH_CONFIG_ERROR",
      hint: "Register the user model before enabling authentication.",
      details: getErrorDetail(routeObj),
    });
  }

  return await Model.findById(id).select("+_id +email +role");
};

const protect =
  (routeObj: Route) =>
  async (
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
            code: "AUTH_REQUIRED",
            hint: "Log in to access this resource.",
            details: getErrorDetail(routeObj),
          }),
        );
      }

      const payload = verifyJWT({
        token,
        routeObj,
      });

      if (typeof payload === "string" || !payload.sub) {
        return next(
          new AppError({
            message: "Invalid JWT payload",
            statusCode: 401,
            code: "AUTH_INVALID_TOKEN",
            hint: "Sign in again to obtain a valid authentication token.",
            details: getErrorDetail(routeObj),
          }),
        );
      }

      const user = await findUser(payload.sub as string, routeObj);

      if (!user) {
        return next(
          new AppError({
            message: "This account no longer exists",
            statusCode: 401,
            code: "AUTH_USER_NOT_FOUND",
            hint: "Sign in with an existing account.",
            details: getErrorDetail(routeObj),
          }),
        );
      }

      req.user = {
        email: user.email,
        role: user.role,
        _id: user._id,
      };

      next();
    } catch (error: unknown) {
      if (error instanceof AppError) {
        return next(error);
      }

      console.error(error);

      return next(
        new AppError({
          message: "Authentication failed",
          statusCode: 500,
          code: "AUTH_MIDDLEWARE_ERROR",
          hint: "This issue requires a fix from the framework developer.",
          details: getErrorDetail(routeObj),
        }),
      );
    }
  };

export default protect;