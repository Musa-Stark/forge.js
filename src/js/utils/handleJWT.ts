import jwt, { type JwtPayload } from "jsonwebtoken";
import AppError from "./AppError.js";
import getDuration, { type DurationType } from "../config/duration.js";
import { getEnvs } from "../config/envs.js";
import getErrorDetail from "./getErrorDetail.js";
import type { Route } from "../types/Collection.js";

export const signJWT = ({
  payload,
  routeObj,
  age,
}: {
  payload: string | object | Buffer;
  routeObj: Route;
  age: DurationType;
}): string => {
  try {
    if (!payload) {
      throw new AppError({
        message: "JWT payload is missing",
        code: "JWT_PAYLOAD_MISSING",
        statusCode: 400,
        hint: "Provide a valid payload to generate the JWT.",
        details: getErrorDetail(routeObj),
      });
    }

    const { jwtSecret } = getEnvs();

    if (!jwtSecret) {
      throw new AppError({
        message: "JWT secret is not configured",
        code: "JWT_SECRET_MISSING",
        statusCode: 500,
        hint: "Configure 'jwtSecret' in the environment variables.",
        details: getErrorDetail(routeObj),
      });
    }

    if (!age) {
      throw new AppError({
        message: "JWT expiration time is not configured",
        code: "JWT_AGE_MISSING",
        statusCode: 500,
        hint: "Configure the access or refresh token age in 'authConfigObj'.",
        details: getErrorDetail(routeObj),
      });
    }

    return jwt.sign(payload, jwtSecret, {
      expiresIn: Math.floor(getDuration(age, routeObj) / 1000),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;

    console.error(error);

    throw new AppError({
      message: "Failed to generate JWT",
      code: "JWT_SIGN_FAILED",
      statusCode: 500,
      hint: "This is an internal framework error. Check the server logs for details.",
      details: getErrorDetail(routeObj),
    });
  }
};

export const verifyJWT = ({
  token,
  routeObj,
}: {
  token: string;
  routeObj: Route;
}): string | JwtPayload => {
  try {
    if (!token)
      throw new AppError({
        message: "JWT is missing",
        code: "JWT_MISSING",
        statusCode: 400,
        hint: "Provide a JWT to verify.",
        details: getErrorDetail(routeObj),
      });

    const { jwtSecret } = getEnvs();

    if (!jwtSecret)
      throw new AppError({
        message: "JWT secret is not configured",
        code: "JWT_SECRET_MISSING",
        statusCode: 500,
        hint: "Configure 'jwtSecret' in the environment variables.",
        details: getErrorDetail(routeObj),
      });

    return jwt.verify(token, jwtSecret);
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError({
      message: "JWT is invalid or has expired",
      code: "JWT_INVALID",
      statusCode: 401,
      hint: "Provide a valid, unexpired JWT.",
      details: getErrorDetail(routeObj),
    });
  }
};
