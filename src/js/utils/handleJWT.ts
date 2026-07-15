import jwt, { type JwtPayload, type Secret } from "jsonwebtoken";
import AppError from "./AppError.js";
import getDuration from "../config/duration.js";
import { getEnvs } from "../config/envs.js";

export const signJWT = ({
  payload,
}: {
  payload: string | object | Buffer;
}): string => {
  const { jwtSecret, tokenExpiry } = getEnvs();

  try {
    if (!jwtSecret) throw new Error("jwtSecret is required");
    if (!tokenExpiry) throw new Error("tokenExpiry is required");

    return jwt.sign(payload, jwtSecret, {
      expiresIn: Math.floor(getDuration(tokenExpiry) / 1000),
    });
  } catch (error) {
    throw new AppError({
      message: error instanceof Error ? error.message : "Failed to sign JWT",
      statusCode: 500,
    });
  }
};

export const verifyJWT = ({
  token,
}: {
  token: string;
}): string | JwtPayload => {
  const { jwtSecret } = getEnvs();
  if (!jwtSecret)
    throw new AppError({ message: "jwtSecret is required", statusCode: 409 });

  if (!token)
    throw new AppError({ message: "jwt token is required", statusCode: 409 });

  try {
    return jwt.verify(token, jwtSecret);
  } catch (err) {
    throw new AppError({
      message: "Invalid or expired token",
      statusCode: 401,
    });
  }
};
