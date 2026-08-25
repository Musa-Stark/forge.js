import type { Route } from "../types/Collection.js";
import AppError from "../utils/AppError.js";

export const DURATIONS = {
  // Seconds
  "0s": 1 * 1000,
  "5s": 5 * 1000,
  "10s": 10 * 1000,
  "15s": 15 * 1000,
  "20s": 20 * 1000,
  "30s": 30 * 1000,
  "45s": 45 * 1000,

  // Minutes
  "1m": 1 * 60 * 1000,
  "2m": 2 * 60 * 1000,
  "3m": 3 * 60 * 1000,
  "5m": 5 * 60 * 1000,
  "10m": 10 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "20m": 20 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "45m": 45 * 60 * 1000,

  // Hours
  "1h": 1 * 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "3h": 3 * 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "8h": 8 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "18h": 18 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,

  // Days
  "1d": 1 * 24 * 60 * 60 * 1000,
  "2d": 2 * 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "4d": 4 * 24 * 60 * 60 * 1000,
  "5d": 5 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "10d": 10 * 24 * 60 * 60 * 1000,
  "14d": 14 * 24 * 60 * 60 * 1000,
  "21d": 21 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,

  // Weeks
  "1w": 7 * 24 * 60 * 60 * 1000,
  "2w": 14 * 24 * 60 * 60 * 1000,
  "3w": 21 * 24 * 60 * 60 * 1000,
  "4w": 28 * 24 * 60 * 60 * 1000,
  "6w": 42 * 24 * 60 * 60 * 1000,
  "8w": 56 * 24 * 60 * 60 * 1000,

  // Months (30-day approximation)
  "1mo": 30 * 24 * 60 * 60 * 1000,
  "2mo": 60 * 24 * 60 * 60 * 1000,
  "3mo": 90 * 24 * 60 * 60 * 1000,
  "6mo": 180 * 24 * 60 * 60 * 1000,
  "9mo": 270 * 24 * 60 * 60 * 1000,
  "12mo": 365 * 24 * 60 * 60 * 1000,

  // Years
  "1y": 365 * 24 * 60 * 60 * 1000,
  "2y": 2 * 365 * 24 * 60 * 60 * 1000,
  "3y": 3 * 365 * 24 * 60 * 60 * 1000,
  "5y": 5 * 365 * 24 * 60 * 60 * 1000,
};

export type DurationType = keyof typeof DURATIONS;

const getDuration = (key: DurationType, routeObj: Route) => {
  if (!(key in DURATIONS))
    throw new AppError({
      message: "Invalid duration key",
      statusCode: 409,
      hint: 'Write duration like "1m", "1h" or "1d"',
      details: {
        handler: routeObj.handler || "",
        method: routeObj.method || "",
        path: routeObj.path || "",
      },
    });

  return DURATIONS[key];
};

export default getDuration;
