import { rateLimit } from "express-rate-limit";
import { getEnvs } from "../config/envs.js";
import getDuration from "../config/duration.js";

export const rateLimiter = () => {
  const { maxReqLimit, rateLimitDuration, rateLimitMsg } = getEnvs();

  return rateLimit({
    windowMs: getDuration(rateLimitDuration),
    max: maxReqLimit,
    standardHeaders: true,
    legacyHeaders: false,

    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        message: rateLimitMsg,
      });
    },
  });
};
