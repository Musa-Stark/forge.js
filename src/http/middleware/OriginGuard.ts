import type { RequestHandler } from "express";
import { ErrorCode, ForbiddenError } from "../../errors/index.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for cookie-based sessions.
 *
 * Because auth cookies may be `SameSite=None` (needed by cross-site SPAs), a
 * state-changing request must come from an allowed origin. Browsers always
 * send `Origin` on such requests; non-browser clients (curl, mobile apps)
 * send none and are not subject to CSRF.
 */
export const originGuard = (allowedOrigins: readonly string[]): RequestHandler => {
  const allowed = new Set(allowedOrigins.map((o) => o.replace(/\/+$/, "")));
  return (req, _res, next) => {
    if (allowed.size === 0 || SAFE_METHODS.has(req.method)) return next();

    const origin = req.get("origin");
    if (!origin || allowed.has(origin.replace(/\/+$/, ""))) return next();

    next(
      new ForbiddenError({
        message: "Request origin is not allowed.",
        code: ErrorCode.CSRF_ORIGIN_REJECTED,
        hint: "Add the front-end origin to 'frontendURL' / 'frontendURLs'.",
      }),
    );
  };
};
