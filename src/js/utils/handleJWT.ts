import jwt, { type JwtPayload } from "jsonwebtoken";
import AppError from "./AppError.js";
import getDuration from "../config/duration.js";
import { getEnvs } from "../config/envs.js";
import getErrorDetail from "./getErrorDetail.js";
import type { Route } from "../types/Collection.js";

export const signJWT = ({
  payload,
  routeObj,
}: {
  payload: string | object | Buffer;
  routeObj: Route;
}): string => {
  try {
    if (!payload) {
      throw new AppError({
        message: "Payload is required to sign a JWT",
        statusCode: 400,
        hint: "Provide a valid payload for JWT generation.",
        details: getErrorDetail(routeObj),
      });
    }

    const { jwtSecret, tokenExpiry } = getEnvs();

    if (!jwtSecret) {
      throw new AppError({
        message: "JWT secret is required",
        statusCode: 500,
        hint: "Configure 'jwtSecret' in your environment variables.",
        details: getErrorDetail(routeObj),
      });
    }

    if (!tokenExpiry) {
      throw new AppError({
        message: "Token expiry is required",
        statusCode: 500,
        hint: "Configure 'tokenExpiry' in your environment variables.",
        details: getErrorDetail(routeObj),
      });
    }

    return jwt.sign(payload, jwtSecret, {
      expiresIn: Math.floor(getDuration(tokenExpiry, routeObj) / 1000),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;

    console.error(error);

    throw new AppError({
      message: "Failed to sign JWT",
      statusCode: 500,
      hint: "This issue requires a fix from the framework developer.",
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
    if (!token) {
      throw new AppError({
        message: "JWT token is required",
        statusCode: 400,
        hint: "Provide a valid JWT for verification.",
        details: getErrorDetail(routeObj),
      });
    }

    const { jwtSecret } = getEnvs();

    if (!jwtSecret) {
      throw new AppError({
        message: "JWT secret is required",
        statusCode: 500,
        hint: "Configure 'jwtSecret' in your environment variables.",
        details: getErrorDetail(routeObj),
      });
    }

    return jwt.verify(token, jwtSecret);
  } catch (error) {
    if (error instanceof AppError) throw error;

    console.error(error);

    throw new AppError({
      message: "Invalid or expired JWT",
      statusCode: 401,
      hint: "Ensure the token is valid, has not expired, and was signed using the correct secret.",
      details: getErrorDetail(routeObj),
    });
  }
};