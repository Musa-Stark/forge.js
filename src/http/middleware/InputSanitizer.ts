import type { RequestHandler } from "express";
import { stripDangerousKeys } from "../../utils/sanitizeInput.js";

/** Strips `$operators`, dotted keys and prototype-pollution keys from body, query and params. */
export const inputSanitizer = (): RequestHandler => (req, _res, next) => {
  stripDangerousKeys(req.body);
  stripDangerousKeys(req.query);
  stripDangerousKeys(req.params);
  next();
};
