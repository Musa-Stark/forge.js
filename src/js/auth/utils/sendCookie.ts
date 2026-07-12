import type { Response } from "express";
import getDuration from "../../config/duration.js";
import { getEnvs } from "../../config/envs.js";
import AppError from "../../utils/AppError.js";
import { signJWT } from "../../utils/handleJWT.js";

export const sendCookie = ({
  res,
  cookieName,
  payload,
}: {
  res: Response;
  cookieName: string;
  payload: string | object;
}) => {
  // tokenExpiry + ENV + domain
  const { tokenExpiry, ENV, domain } = getEnvs();

  if (!ENV)
    throw new AppError({
      message: "tokenExpiry and ENV are requried for cookie",
      statusCode: 409,
    });

  if (ENV === "production" && !domain)
    throw new AppError({
      message: "environment is set: production and domain: not found",
      statusCode: 409,
    });

  // token
  const token = signJWT({ payload });

  // send cookie
  res.cookie(cookieName, token, {
    httpOnly: true,
    maxAge: getDuration(tokenExpiry),
    sameSite: ENV === "production" ? "none" : "lax",
    secure: ENV === "production" ? true : false,
    domain: ENV === "production" ? domain : undefined,
  });
};

export const clearCookie = ({
  res,
  cookieName,
}: {
  res: Response;
  cookieName: string;
}) => {
  // ENV + domain
  const { ENV, domain } = getEnvs();

  if (!ENV)
    throw new AppError({
      message: "ENV is required for clearing cookie",
      statusCode: 409,
    });

  if (ENV === "production" && !domain)
    throw new AppError({
      message: "environment is set: production and domain: not found",
      statusCode: 409,
    });

  // clear cookie
  res.clearCookie(cookieName, {
    httpOnly: true,
    sameSite: ENV === "production" ? "none" : "lax",
    secure: ENV === "production",
    domain: ENV === "production" ? domain : undefined,
  });
};
