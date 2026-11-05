import type { Request, RequestHandler } from "express";
import type { ForgeConfig } from "../config/ForgeConfig.js";
import { ErrorCode, ForbiddenError, UnauthorizedError } from "../errors/index.js";
import type { DataSource } from "../data/Repository.js";
import type { TokenService } from "../security/TokenService.js";
import type { AuthenticatedUser } from "../types/AuthenticatedUser.js";
import type { AccessLevel } from "../types/Route.js";
import type { VerifiedCustomTokenClaims } from "../security/TokenService.js";

/** Custom token source and request property configuration for custom-token middleware. */
export interface CustomAuthOptions {
  /** Read the token from any request location. Defaults to Bearer auth, then the `customToken` cookie. */
  extractToken?: (req: Request) => string | undefined;
  /** Request property that receives the verified claims. @default "customToken" */
  name?: string;
  /** Cookie name used by the default token extractor. @default "customToken" */
  cookieName?: string;
}

/**
 * Resolves who is calling and enforces a route's access level.
 *
 * The access token is read from `Authorization: Bearer ...` first and from
 * the access-token cookie second. It is never read from the request body.
 */
export class Authenticator {
  constructor(
    private readonly config: ForgeConfig,
    private readonly tokens: TokenService,
    private readonly data: DataSource,
  ) {}

  isAdmin(user: AuthenticatedUser | undefined): boolean {
    return Boolean(user?.role && this.config.adminRoles.includes(user.role));
  }

  /** True when the user's role is exactly one of `roles`. */
  hasAnyRole(user: AuthenticatedUser | undefined, roles: readonly string[]): boolean {
    return Boolean(user?.role && roles.includes(user.role));
  }

  /**
   * Middleware factory for one access level, optionally narrowed to specific roles.
   * `public` routes get no guard. Authentication comes first, so an anonymous caller always gets 401, never 403.
   */
  require(level: AccessLevel, roles?: readonly string[]): RequestHandler {
    if (level === "public") return (_req, _res, next) => next();

    return async (req, _res, next) => {
      try {
        req.user = await this.authenticate(req);
        if (level === "admin" && !this.isAdmin(req.user)) {
          throw new ForbiddenError({
            message: "Administrator access is required.",
            code: ErrorCode.ADMIN_REQUIRED,
          });
        }
        if (roles && !this.hasAnyRole(req.user, roles)) {
          throw new ForbiddenError({
            message: "Your role is not allowed to do this.",
            code: ErrorCode.ROLE_NOT_ALLOWED,
            hint: `Allowed roles: ${roles.join(", ")}.`,
          });
        }
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /** Middleware for application-defined signed tokens, with a customizable source and claim mapping. */
  requireCustom(options: CustomAuthOptions = {}): RequestHandler {
    return async (req, _res, next) => {
      try {
        const claims = this.tokens.verifyCustom((options.extractToken ?? ((request) => this.extractCustomToken(request, options.cookieName)))(req));
        const name = options.name ?? "customToken";
        if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
          throw new TypeError("Custom auth request property name must be a valid JavaScript identifier.");
        }
        (req as Request & Record<string, unknown>)[name] = claims;
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  private extractCustomToken(req: Request, cookieName = "customToken"): string | undefined {
    const header = req.get("authorization");
    if (header) {
      const [scheme, value] = header.split(" ");
      if (scheme?.toLowerCase() === "bearer" && value) return value;
    }
    const cookie = (req.cookies as Record<string, unknown> | undefined)?.[cookieName];
    return typeof cookie === "string" ? cookie : undefined;
  }

  async authenticate(req: Request): Promise<AuthenticatedUser> {
    const claims = this.tokens.verifyAccess(this.extractToken(req));

    if (!this.config.auth.verifyAccessUser) return { _id: claims.sub };

    const modelName = this.config.auth.mongooseConfig?.model ?? this.userModelFromCollections();
    if (!modelName || !this.data.has(modelName)) return { _id: claims.sub };

    const user = await this.data.repository(modelName).findById(claims.sub);
    if (!user) {
      throw new UnauthorizedError({
        message: "The account for this token no longer exists.",
        code: ErrorCode.ACCESS_USER_NOT_FOUND,
      });
    }
    return { _id: user._id, role: typeof user.role === "string" ? user.role : undefined };
  }

  private extractToken(req: Request): string | undefined {
    const header = req.get("authorization");
    if (header) {
      const [scheme, value] = header.split(" ");
      if (scheme?.toLowerCase() === "bearer" && value) return value;
    }
    const cookie = (req.cookies as Record<string, unknown> | undefined)?.[this.config.auth.accessTokenName];
    return typeof cookie === "string" ? cookie : undefined;
  }

  private userModelFromCollections(): string | undefined {
    return this.config.collections.find((c) => c.type === "auth" || c.type === "account")?.model;
  }
}
