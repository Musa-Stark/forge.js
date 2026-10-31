import type { NextFunction, Request, RequestHandler, Response, Router } from "express";
import { ConfigurationError, ErrorCode } from "../errors/index.js";
import type { Collection, CollectionType } from "../types/Collection.js";
import type { AccessLevel, Route } from "../types/Route.js";
import { RouteContext } from "./RouteContext.js";
import type { Services } from "./Services.js";

/** A route handler. Returned promises are awaited by Express 5, so rejections reach the error handler. */
export type HandlerFn = (req: Request, res: Response, ctx: RouteContext) => Promise<void>;

/** Handlers that read multipart form data. */
const MULTIPART_HANDLERS = new Set(["create", "update", "addFile", "updateFile"]);
/** Handlers that take `files` as configuration only (they identify a field but receive no upload). */
const FILE_CONFIG_HANDLERS = new Set(["deleteFile"]);

/**
 * One backend feature (crud, auth, account, admin, health).
 *
 * Subclass it, declare the handlers it offers, and register it with
 * `forge.use(new MyModule(services))` to add your own collection types.
 * The base class owns everything repetitive: route validation, the middleware
 * chain (rate limit -> auth -> uploads -> handler) and error forwarding.
 */
export abstract class FeatureModule {
  abstract readonly type: CollectionType | (string & {});

  constructor(protected readonly services: Services) {}

  /** Handler name -> implementation. */
  protected abstract handlers(): Readonly<Record<string, HandlerFn>>;

  /** Access level used when a route does not declare `auth`. */
  protected defaultAuth(_route: Route): AccessLevel {
    return "authenticated";
  }

  /** Whether the route should use the stricter brute-force limiter. */
  protected isSensitive(_route: Route): boolean {
    return false;
  }

  /** Called before routes are registered: register models, check configuration. */
  prepare(_collection: Collection): void {}

  /** Checks that apply to every module: `roles`, and anything that needs the user's role to be loaded. */
  private validateAccess(route: Route): string[] {
    const problems: string[] = [];
    const { roles } = route;

    if (roles !== undefined) {
      if (!Array.isArray(roles) || roles.length === 0 || roles.some((r) => typeof r !== "string" || r === "")) {
        problems.push("'roles' must be a non-empty array of role names, e.g. roles: [\"editor\", \"admin\"].");
      } else if (route.auth === "public") {
        problems.push("'roles' cannot be used on a 'public' route: nobody is signed in, so nobody has a role. Use auth: 'authenticated'.");
      } else if (route.auth === "admin") {
        problems.push("'roles' cannot be combined with auth 'admin' (that already means the roles in `adminRoles`). Use auth: 'authenticated' and list the roles.");
      }
    }

    // A role is read from the user's database record on each request.
    const needsRole = roles !== undefined || route.auth === "admin" || route.auth === "admin-or-owner";
    if (needsRole && !this.services.config.auth.verifyAccessUser) {
      problems.push("this route checks roles, which needs auth.verifyAccessUser: true (otherwise no role is ever loaded and every caller is refused).");
    }
    return problems;
  }

  /** Extra configuration checks. Return one message per problem. */
  protected validateRoute(_collection: Collection, _route: Route): string[] {
    return [];
  }

  register(router: Router, collection: Collection): void {
    const handlers = this.handlers();
    const problems: string[] = [];
    const compiled = this.services.compiler.compileValidations(collection.validations, collection.route);

    for (const original of collection.routes) {
      const where = `${original.method.toUpperCase()} /${collection.route}${original.path}`;
      const handler = handlers[original.handler];
      if (!handler) {
        problems.push(`${where}: handler '${original.handler}' is not available for collections of type '${collection.type}'. Available: ${Object.keys(handlers).join(", ")}.`);
        continue;
      }

      const route: Route = { ...original, auth: original.auth ?? this.defaultAuth(original) };

      if (typeof route.validation === "string" && !compiled.has(route.validation)) {
        problems.push(`${where}: validation '${route.validation}' is not defined in the collection's 'validations'.`);
        continue;
      }
      if (route.validation === true) {
        problems.push(`${where}: 'validation: true' is ambiguous - use the name of a validation group, or false.`);
        continue;
      }
      if (route.files?.length && !MULTIPART_HANDLERS.has(route.handler) && !FILE_CONFIG_HANDLERS.has(route.handler)) {
        problems.push(`${where}: 'files' is only supported on create, update, addFile, updateFile and deleteFile.`);
      }

      try {
        this.services.actions.assertValid(route.actions?.before, `${where} → actions.before`);
        this.services.actions.assertValid(route.actions?.after, `${where} → actions.after`);
      } catch (error) {
        problems.push((error as Error).message);
      }

      problems.push(...this.validateAccess(route).map((m) => `${where}: ${m}`));
      problems.push(...this.validateRoute(collection, route).map((m) => `${where}: ${m}`));

      const validator = typeof route.validation === "string" ? compiled.get(route.validation) : undefined;
      const repository = collection.model && this.services.data.has(collection.model)
        ? this.services.data.repository(collection.model)
        : undefined;
      const ctx = new RouteContext(this.services, collection, route, validator, repository);

      router[route.method](route.path, ...this.chain(route, handler, ctx));
    }

    if (problems.length > 0) {
      throw new ConfigurationError({
        message: `Invalid '${collection.route}' collection:\n - ${problems.join("\n - ")}`,
        code: ErrorCode.CONFIGURATION_ERROR,
        details: { problems },
      });
    }
  }

  private chain(route: Route, handler: HandlerFn, ctx: RouteContext): RequestHandler[] {
    const chain: RequestHandler[] = [];
    if (this.isSensitive(route)) chain.push(this.services.limiters.auth());
    chain.push(this.services.authenticator.require(route.auth ?? "authenticated", route.roles));
    if (route.files?.length && MULTIPART_HANDLERS.has(route.handler)) chain.push(this.services.uploads.parser(route.files));
    chain.push((req: Request, res: Response, next: NextFunction) => {
      handler(req, res, ctx).catch(next);
    });
    return chain;
  }
}
