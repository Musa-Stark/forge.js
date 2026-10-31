import { ConfigurationError } from "../errors/index.js";
import { FeatureModule, type HandlerFn } from "../core/FeatureModule.js";
import type { Services } from "../core/Services.js";
import type { Collection } from "../types/Collection.js";
import type { Route } from "../types/Route.js";
import { CrudController } from "./CrudController.js";
import { FileController } from "./FileController.js";

/** `type: "crud"` collections: database handlers and file handlers. */
export class CrudModule extends FeatureModule {
  readonly type = "crud";
  private readonly crud: CrudController;
  private readonly files: FileController;

  constructor(services: Services) {
    super(services);
    this.crud = new CrudController(services);
    this.files = new FileController(services);
  }

  protected handlers(): Readonly<Record<string, HandlerFn>> {
    return {
      read: this.crud.read,
      readAll: this.crud.readAll,
      create: this.crud.create,
      createBulk: this.crud.createBulk,
      update: this.crud.update,
      remove: this.crud.remove,
      removeMultiple: this.crud.removeMultiple,
      removeAll: this.crud.removeAll,
      addFile: this.files.addFile,
      updateFile: this.files.updateFile,
      deleteFile: this.files.deleteFile,
    };
  }

  override prepare(collection: Collection): void {
    if (!collection.model || !collection.schema) {
      throw new ConfigurationError({
        message: `The '${collection.route}' crud collection needs both 'model' and 'schema'.`,
      });
    }
    this.services.data.register({ name: collection.model, schema: collection.schema });
    this.services.sanitizer.addSecrets(this.services.compiler.secretFieldsOf(collection.schema));
  }

  protected override validateRoute(collection: Collection, route: Route): string[] {
    const problems = [...this.crud.assertSafeRoute(route), ...this.crud.assertPopulate(collection, route)];
    if (["updateFile", "deleteFile"].includes(route.handler) && route.files?.length !== 1) {
      problems.push(`'${route.handler}' needs exactly one entry in 'files'.`);
    }
    if (route.handler === "addFile" && !route.files?.length) problems.push("'addFile' needs at least one entry in 'files'.");
    return problems;
  }
}
