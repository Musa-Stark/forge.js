import type { AuthenticatedUser } from "./AuthenticatedUser.js";
import type { VerifiedCustomTokenClaims } from "../security/TokenService.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by Forge's authentication middleware on protected routes. */
      user?: AuthenticatedUser;
      /** Verified claims set by `forge.customAuth()` using its default property name. */
      customToken?: VerifiedCustomTokenClaims;
      /** Correlates log lines and error responses of one request. */
      requestId?: string;
    }
  }
}

export {};
