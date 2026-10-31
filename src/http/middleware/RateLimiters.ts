import type { RequestHandler } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { ForgeConfig } from "../../config/ForgeConfig.js";
import { TooManyRequestsError } from "../../errors/index.js";

/** Builds the global and the stricter authentication rate limiters. */
export class RateLimiters {
  // One instance per scope: every credential endpoint must draw from the *same* per-IP budget,
  // otherwise an attacker would get a fresh allowance on each route.
  private globalLimiter: RequestHandler | undefined;
  private authLimiter: RequestHandler | undefined;

  constructor(private readonly config: ForgeConfig) {}

  /** Limits every request from one IP. */
  global(): RequestHandler {
    return (this.globalLimiter ??= this.create(this.config.rateLimit.max, "global"));
  }

  /** Brute-force protection for sign-up, login, OTP and password-reset endpoints. */
  auth(): RequestHandler {
    return (this.authLimiter ??= this.create(this.config.rateLimit.authMax, "auth"));
  }

  private create(limit: number, scope: string): RequestHandler {
    const { window, message, store } = this.config.rateLimit;
    return rateLimit({
      windowMs: Math.max(1, window.toMs()),
      limit,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      ...(store ? { store } : {}),
      // Separate counters per scope even when they share a store.
      // IPv6 clients are grouped by /56 so one user cannot dodge the limit by rotating addresses.
      keyGenerator: (req) => `${scope}:${ipKeyGenerator(req.ip ?? "unknown")}`,
      handler: (_req, _res, next) => next(new TooManyRequestsError({ message })),
    });
  }
}
