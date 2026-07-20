import type { Route } from "../types/Collection.js";
import AppError from "../utils/AppError.js";

export const DURATIONS = {
  "1m": 60 * 1000,
  "3m": 3 * 60 * 1000,
  "5m": 5 * 60 * 1000,
  "10m": 10 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "20m": 20 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "14d": 14 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export type DurationType = keyof typeof DURATIONS;

const getDuration = (key: DurationType, route: Route) => {
  if (!DURATIONS[key])
    throw new AppError({
      message: "Invalid duration key",
      statusCode: 409,
      code: "FRAMEWORK_CONFIGURATION_INVALID",
      hint: 'Write duration like "1m", "1h" or "1d"',
      details: {
        handler: route.handler || "",
        method: route.method || "",
        path: route.path || "",
      },
    });

  return DURATIONS[key];
};

export default getDuration;
