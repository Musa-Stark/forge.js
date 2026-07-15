import type { Constructor } from "../types/Constructor.js";

export const defaultConfig: Constructor = {
  port: 5000,
  apiVersion: 1,
  isOffline: true,
  backendURL: "http://localhost:5000/api/v1",
  ENV: "development",
  tokenExpiry: "7d",
  rateLimitDuration: "15min",
  maxReqLimit: 100,
  rateLimitMsg: "RLM: Too many requests, please try again later.",
};
