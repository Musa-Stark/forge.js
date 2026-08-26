import type { NextFunction, Request, Response } from "express";

import { verifyJWT } from "../utils/handleJWT.js";
import AppError from "../utils/AppError.js";
import registerModel from "../lib/model.registry.js";
import { getEnvs } from "../config/envs.js";
import getErrorDetail from "../utils/getErrorDetail.js";
import type { Route } from "../types/Collection.js";
import handleGetToken from "../auth/utils/handleGetToken.js"

export const findUser = async (
  id: string,
  routeObj: Route,
  userModelName: string,
) => {
  if (!userModelName) {
    throw new AppError({
      message: "User model is required for authentication",
      statusCode: 500,
      hint: "Configure 'userModelName' in your environment variables.",
      details: getErrorDetail(routeObj),
    });
  }

  const Model = registerModel[userModelName as string];

  if (!Model) {
    throw new AppError({
      message: `User model '${userModelName}' is not registered`,
      statusCode: 500,
      hint: "Register the user model before enabling authentication.",
      details: getErrorDetail(routeObj),
    });
  }

  return await Model.findById(id).select("+_id +email +role");
};

const protect =
  (routeObj: Route) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userModelName, authConfigObj } = getEnvs();

      const { verifyAccessUser } = authConfigObj;

      const token = handleGetToken({req, routeObj, type: "accessTokenName"});

      if (!token) {
        return next(
          new AppError({
            message: "Access token is missing",
            code: "ACCESS_TOKEN_MISSING",
            statusCode: 401,
            hint: "Request a new access token using the  endpoint. Default: /auth/refresh-token",
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
            message: "Access token payload is invalid",
            code: "ACCESS_TOKEN_PAYLOAD_INVALID",
            statusCode: 401,
            hint: "Sign in again to obtain a valid access token.",
            details: getErrorDetail(routeObj),
          }),
        );
      }

      if (verifyAccessUser) {
        const user = await findUser(
          payload.sub as string,
          routeObj,
          userModelName!
        );

        if (!user) {
          return next(
            new AppError({
              message: "User associated with the access token was not found",
              code: "ACCESS_USER_NOT_FOUND",
              statusCode: 401,
              hint: "Sign in again with an existing account.",
              details: getErrorDetail(routeObj),
            }),
          );
        }
      }

      req.user = {
        _id: payload.sub,
      };

      next();
    } catch (error: unknown) {
      if (error instanceof AppError) {
        return next(error);
      }

      console.error(error);

      return next(
        new AppError({
          message: "Authentication middleware failed",
          statusCode: 500,
          hint: "This issue requires a fix from the framework developer.",
          details: getErrorDetail(routeObj),
        }),
      );
    }
  };

export default protect;
