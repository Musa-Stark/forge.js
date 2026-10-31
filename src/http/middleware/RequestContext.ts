import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const SAFE_ID = /^[\w-]{8,64}$/;

/** Gives each request an id (reusing a well-formed `x-request-id`) and echoes it back. */
export const requestContext = (): RequestHandler => (req, res, next) => {
  const incoming = req.get("x-request-id");
  req.requestId = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
};
