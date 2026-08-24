import type { InternalConstructor } from "../types/Constructor.js";

export const defaultConfig: InternalConstructor = {
  authConfigObj: {
    mode: "manual",
  },
  port: 5000,
  apiVersion: 1,
  isOffline: true,
  backendURL: "http://localhost:5000/api/v1",
  ENV: "development",
  rateLimitDuration: "15m",
  maxReqLimit: 100,
  rateLimitMsg: "RLM: Too many requests, please try again later.",
  userModelName: "otpUser",
};
