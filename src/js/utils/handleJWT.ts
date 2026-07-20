import jwt, { type JwtPayload } from "jsonwebtoken";
import AppError from "./AppError.js";
import getDuration from "../config/duration.js";
import { getEnvs } from "../config/envs.js";
import getErrorDetail from "./getErrorDetail.js";
import type { Route } from "../types/Collection.js";

export const signJWT = ({
  payload,
  route,
}: {
  payload: string | object | Buffer;
  route: Route;
}): string => {
  try {
    if (!payload) {
      throw new AppError({
        message: "Payload is required to sign a JWT",
        statusCode: 400,
        code: "JWT_SIGN_ERROR",
        hint: "Provide a valid payload for JWT generation.",
        details: getErrorDetail(route),
      });
    }

    const { jwtSecret, tokenExpiry } = getEnvs();

    if (!jwtSecret) {
      throw new AppError({
        message: "JWT secret is required",
        statusCode: 500,
        code: "JWT_SIGN_ERROR",
        hint: "Configure 'jwtSecret' in your environment variables.",
        details: getErrorDetail(route),
      });
    }

    if (!tokenExpiry) {
      throw new AppError({
        message: "Token expiry is required",
        statusCode: 500,
        code: "JWT_SIGN_ERROR",
        hint: "Configure 'tokenExpiry' in your environment variables.",
        details: getErrorDetail(route),
      });
    }

    return jwt.sign(payload, jwtSecret, {
      expiresIn: Math.floor(getDuration(tokenExpiry) / 1000),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;

    console.error(error);

    throw new AppError({
      message: "Failed to sign JWT",
      statusCode: 500,
      code: "JWT_SIGN_ERROR",
      hint: "This issue requires a fix from the framework developer.",
      details: getErrorDetail(route),
    });
  }
};

export const verifyJWT = ({
  token,
  route,
}: {
  token: string;
  route: Route;
}): string | JwtPayload => {
  try {
    if (!token) {
      throw new AppError({
        message: "JWT token is required",
        statusCode: 400,
        code: "JWT_VERIFY_ERROR",
        hint: "Provide a valid JWT for verification.",
        details: getErrorDetail(route),
      });
    }

    const { jwtSecret } = getEnvs();

    if (!jwtSecret) {
      throw new AppError({
        message: "JWT secret is required",
        statusCode: 500,
        code: "JWT_VERIFY_ERROR",
        hint: "Configure 'jwtSecret' in your environment variables.",
        details: getErrorDetail(route),
      });
    }

    return jwt.verify(token, jwtSecret);
  } catch (error) {
    if (error instanceof AppError) throw error;

    console.error(error);

    throw new AppError({
      message: "Invalid or expired JWT",
      statusCode: 401,
      code: "JWT_VERIFY_ERROR",
      hint: "Ensure the token is valid, has not expired, and was signed using the correct secret.",
      details: getErrorDetail(route),
    });
  }
};