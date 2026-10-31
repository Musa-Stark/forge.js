import { FeatureModule, type HandlerFn } from "../core/FeatureModule.js";
import type { Services } from "../core/Services.js";
import { RoleController } from "../account/RoleController.js";
import type { Collection } from "../types/Collection.js";
import type { AccessLevel } from "../types/Route.js";

/**
 * `type: "admin"` collections. Routes default to administrators only.
 *
 * @deprecated Kept so 1.x apps keep working. The role check is not admin-specific: use `type: "account"` with
 * `handler: "checkRole"` (`GET /account/role`), and protect other routes with `auth: "admin"` or `roles: [...]`.
 */
export class AdminModule extends FeatureModule {
  readonly type = "admin";
  private readonly roles: RoleController;

  constructor(services: Services) {
    super(services);
    this.roles = new RoleController(services);
  }

  protected handlers(): Readonly<Record<string, HandlerFn>> {
    return {
      checkRole: this.roles.checkRole,
      /** @deprecated The 1.x name of `checkRole`. It always returned the caller's role, whatever it was. */
      checkAdmin: this.roles.checkRole,
    };
  }

  override prepare(collection: Collection): void {
    if (collection.routes.some((r) => r.handler === "checkAdmin")) {
      this.services.logger.warn(
        `'${collection.route}': handler 'checkAdmin' is deprecated - it returns the caller's role, whatever it is. Rename it to 'checkRole'.`,
      );
    }
  }

  protected override defaultAuth(): AccessLevel {
    return "admin";
  }
}
