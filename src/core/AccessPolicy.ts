import { ErrorCode, ForbiddenError } from "../errors/index.js";
import type { Authenticator } from "../http/Authenticator.js";
import type { Filter, Doc } from "../data/Repository.js";
import type { ForgeConfig } from "../config/ForgeConfig.js";
import type { AuthenticatedUser } from "../types/AuthenticatedUser.js";
import type { Route } from "../types/Route.js";
import { idToString } from "../utils/ids.js";
import { omitKeys } from "../utils/sanitizeInput.js";

const DEFAULT_OWNER_FIELD = "owner";

/**
 * Decides who may touch which document.
 *
 * `admin-or-owner` routes used to check ownership against only the *first*
 * document of a list, which leaked every other user's data. Lists are now
 * restricted with a database filter, and single documents are checked one by one.
 */
export class AccessPolicy {
  constructor(
    private readonly config: ForgeConfig,
    private readonly authenticator: Authenticator,
  ) {}

  isAdmin(user: AuthenticatedUser | undefined): boolean {
    return this.authenticator.isAdmin(user);
  }

  /** Id of the user who owns `doc` under the route's ownership rule. */
  ownerOf(doc: Doc, route: Route): string | undefined {
    return route.ownership === "self" ? idToString(doc._id) : idToString(doc[this.config.auth.ownerField ?? DEFAULT_OWNER_FIELD]);
  }

  /** Throws unless `user` may access `doc` through `route`. */
  assertCanAccess(route: Route, user: AuthenticatedUser | undefined, doc: Doc): void {
    if (route.auth !== "admin-or-owner") return;
    if (this.isAdmin(user)) return;
    if (user && this.ownerOf(doc, route) === user._id) return;
    throw new ForbiddenError({
      message: "You can only access your own data.",
      code: ErrorCode.OWNER_REQUIRED,
    });
  }

  /** Database filter that limits a multi-document operation to what `user` may see. */
  scopeFilter(route: Route, user: AuthenticatedUser | undefined): Filter {
    if (route.auth !== "admin-or-owner" || this.isAdmin(user)) return {};
    if (!user) throw new ForbiddenError({ message: "Authentication is required.", code: ErrorCode.FORBIDDEN });
    return route.ownership === "self" ? { _id: user._id } : { [this.config.auth.ownerField ?? DEFAULT_OWNER_FIELD]: user._id };
  }

  /** The owner value to stamp on a new document. */
  ownerStamp(user: AuthenticatedUser | undefined): Record<string, unknown> {
    return user ? { [this.config.auth.ownerField ?? DEFAULT_OWNER_FIELD]: user._id } : {};
  }

  /**
   * Strips fields only administrators may write from a payload: the configured `protectedFields` (default
   * `role`) and `owner`. The owner is stamped from the session when a document is created, so without this a
   * non-admin could hand a document to another user by sending `owner` in an update.
   */
  writableBody<T extends Record<string, unknown>>(body: T, user: AuthenticatedUser | undefined): Partial<T> {
    return this.isAdmin(user) ? body : omitKeys(body, [...this.config.protectedFields, this.config.auth.ownerField ?? DEFAULT_OWNER_FIELD]);
  }
}
