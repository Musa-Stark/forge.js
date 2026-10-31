import { FeatureModule, type HandlerFn } from "../core/FeatureModule.js";
import type { Services } from "../core/Services.js";
import { ConfigurationError } from "../errors/index.js";
import type { Collection } from "../types/Collection.js";
import { AccountController } from "./AccountController.js";
import { RoleController } from "./RoleController.js";

/** `type: "account"` collections: the signed-in user's own profile (`/me`) and role (`/role`). */
export class AccountModule extends FeatureModule {
  readonly type = "account";
  private readonly controller: AccountController;
  private readonly roles: RoleController;

  constructor(services: Services) {
    super(services);
    this.controller = new AccountController(services);
    this.roles = new RoleController(services);
  }

  protected handlers(): Readonly<Record<string, HandlerFn>> {
    return {
      getMe: this.controller.getMe,
      updateMe: this.controller.updateMe,
      deleteMe: this.controller.deleteMe,
      checkRole: this.roles.checkRole,
    };
  }

  override prepare(collection: Collection): void {
    if (!this.services.userModel) {
      throw new ConfigurationError({
        message: "The account module needs a user model.",
        hint: "Enable builtinConfig.auth (builtin) or declare a collection of type 'auth'.",
      });
    }
    if (collection.model && collection.schema) {
      this.services.data.register({ name: collection.model, schema: collection.schema });
    }
  }
}
