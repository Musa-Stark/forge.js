import type { Request, Response } from "express";
import { ConfigurationError, ErrorCode, NotFoundError } from "../errors/index.js";
import type { RouteContext } from "../core/RouteContext.js";
import type { Services } from "../core/Services.js";

/**
 * "What is my role?" for any signed-in user - not just administrators.
 *
 * Front-ends use it to decide which screens to show; the server still enforces access on every route
 * (`auth` / `roles`), so this is information, not authorisation.
 */
export class RoleController {
  constructor(private readonly services: Services) {}

  /** Responds `{ role, isAdmin }`. 404 `ROLE_NOT_FOUND` if the account has no role at all. */
  checkRole = async (req: Request, res: Response, _ctx: RouteContext): Promise<void> => {
    const role = await this.roleOf(req);
    if (!role) {
      throw new NotFoundError({
        message: "No role is set for this account.",
        code: ErrorCode.ROLE_NOT_FOUND,
        hint: "Add a 'role' field to the user schema, e.g. role: fields.role.",
      });
    }
    this.services.responses.success(res, {
      message: "Role found successfully.",
      data: { role, isAdmin: this.services.access.isAdmin({ _id: req.user!._id, role }) },
    });
  };

  /** The role the authenticator already loaded, or - when it skipped the user lookup - read it from the database. */
  private async roleOf(req: Request): Promise<string | undefined> {
    const known = req.user?.role;
    if (typeof known === "string" && known !== "") return known;
    // With verifyAccessUser on, the authenticator already looked the user up: no role means no role.
    if (this.services.config.auth.verifyAccessUser) return undefined;

    if (!this.services.userModel) {
      throw new ConfigurationError({ message: "The role check needs a user model.", hint: "Enable builtinConfig.auth or declare a collection of type 'auth'." });
    }
    const user = await this.services.data.repository(this.services.userModel).findById(req.user?._id ?? "");
    return typeof user?.role === "string" && user.role !== "" ? user.role : undefined;
  }
}
