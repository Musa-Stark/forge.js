import type { AuthenticatedUser } from "./AuthenticatedUser.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by Forge's authentication middleware on protected routes. */
      user?: AuthenticatedUser;
      /** Correlates log lines and error responses of one request. */
      requestId?: string;
    }
  }
}

export {};
