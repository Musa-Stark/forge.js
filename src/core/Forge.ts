import compression from "compression";
import cookieParser from "cookie-parser";
import cors, { type CorsOptions } from "cors";
import express, { type Express, type RequestHandler } from "express";
import helmet from "helmet";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import morgan from "morgan";
import { AccountModule } from "../account/AccountModule.js";
import { AdminModule } from "../admin/AdminModule.js";
import { AuthModule } from "../auth/AuthModule.js";
import { ForgeConfig } from "../config/ForgeConfig.js";
import type { ForgeOptions } from "../config/ForgeOptions.js";
import { CrudModule } from "../crud/CrudModule.js";
import { ConfigurationError, ErrorCode } from "../errors/index.js";
import { HealthModule } from "../health/HealthModule.js";
import { ErrorHandler } from "../http/middleware/ErrorHandler.js";
import { inputSanitizer } from "../http/middleware/InputSanitizer.js";
import { originGuard } from "../http/middleware/OriginGuard.js";
import { requestContext } from "../http/middleware/RequestContext.js";
import { BannerPrinter } from "../terminal/BannerPrinter.js";
import type { Collection } from "../types/Collection.js";
import type { AccessLevel } from "../types/Route.js";
import "../types/express.js";
import { BuiltinCollections } from "./BuiltinCollections.js";
import type { FeatureModule } from "./FeatureModule.js";
import type { Services } from "./Services.js";
import { ServiceFactory, type ForgeDependencies } from "./ServiceFactory.js";

const ROUTE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9/_-]*$/;

/**
 * The framework.
 *
 * ```ts
 * const forge = new Forge({ jwtSecret, mongoDBURI, collections: [...] });
 * await forge.start();
 * ```
 *
 * `build()` returns the configured Express app without opening any
 * connection, which is what you want in tests (`supertest`, `fetch`...).
 */
export class Forge {
  readonly config: ForgeConfig;
  readonly services: Services;
  readonly app: Express = express();

  private readonly modules = new Map<string, FeatureModule>();
  private readonly allCollections: Collection[];
  private server: Server | undefined;
  private built = false;
  private signalHandlers: Array<[NodeJS.Signals, () => void]> = [];

  constructor(
    options: ForgeOptions = {},
    dependencies: ForgeDependencies = {},
  ) {
    // Install parsers as soon as Forge creates the app so routes registered
    // directly on `forge.app` before build() can read req.body and req.cookies.
    this.app.use(cookieParser());
    this.app.use(express.json({ limit: options.bodyLimit ?? "100kb" }));
    this.app.use(express.urlencoded({ extended: false, limit: options.bodyLimit ?? "100kb" }));

    this.config = new ForgeConfig(options);
    this.services = new ServiceFactory().create(this.config, dependencies);

    for (const warning of this.config.warnings)
      this.services.logger.warn(warning);

    for (const module of [
      new CrudModule(this.services),
      new AuthModule(this.services),
      new AccountModule(this.services),
      new AdminModule(this.services),
      new HealthModule(this.services),
    ]) {
      this.modules.set(module.type, module);
    }

    this.allCollections = [
      ...new BuiltinCollections(this.config, this.services.compiler).build(),
      ...this.config.collections,
    ];
    Forge.lastCreated = this;
  }

  /** The most recently created instance (used by the deprecated `startServer()` shortcut). */
  static lastCreated: Forge | undefined;

  /** Add a custom collection type, or replace a built-in module. */
  use(module: FeatureModule): this {
    if (this.built)
      throw new ConfigurationError({
        message: "Call use() before build() / start().",
      });
    this.modules.set(module.type, module);
    return this;
  }

  /** Verify the access token and set `req.user` before a custom route handler. */
  auth(level: AccessLevel = "authenticated", roles?: readonly string[]): RequestHandler {
    return this.services.authenticator.require(level, roles);
  }

  get collections(): readonly Collection[] {
    return this.allCollections;
  }

  /** Assembles the middleware stack and mounts every collection. Safe to call more than once. */
  build(): Express {
    if (this.built) return this.app;
    const { app, config, services } = this;

    app.disable("x-powered-by");
    app.set("trust proxy", config.trustProxy);

    const errors = new ErrorHandler(config, services.logger);

    app.use(requestContext());
    app.use(helmet());
    app.use(cors(this.corsOptions()));
    if (config.logRequests) {
      app.use(
        morgan("tiny", {
          stream: { write: (line) => services.logger.info(line.trim()) },
        }),
      );
    }
    app.use(compression());
    app.use(services.limiters.global());
    app.use(inputSanitizer());
    app.use(originGuard(this.allowedOrigins()));

    this.mountCollections();

    app.use(errors.notFound());
    app.use(errors.handler());

    this.built = true;
    return app;
  }

  async start(): Promise<Server> {
    if (this.server) return this.server;
    this.build();

    await this.services.data.connect();

    // Express 5 hands listen errors (EADDRINUSE...) to this callback instead of throwing.
    const server = await new Promise<Server>((resolve, reject) => {
      const s = this.app.listen(this.config.port, (error?: Error) =>
        error ? reject(error) : resolve(s),
      );
    });
    this.server = server;

    if (this.config.logRequests) {
      new BannerPrinter(this.config).print(
        this.allCollections,
        "Connected",
        (server.address() as AddressInfo).port,
      );
    }
    if (!this.config.isTest) this.installSignalHandlers();
    return server;
  }

  /** Stops accepting connections, waits for in-flight requests, then closes the database. */
  async stop(): Promise<void> {
    for (const [signal, handler] of this.signalHandlers)
      process.off(signal, handler);
    this.signalHandlers = [];

    const server = this.server;
    this.server = undefined;
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeIdleConnections?.();
      });
    }
    await this.services.data.disconnect();
  }

  private mountCollections(): void {
    const { config, services } = this;
    const seen = new Set<string>();

    // Prepare every collection first (registers models), then mount routes.
    for (const collection of this.allCollections) {
      if (!ROUTE_SEGMENT.test(collection.route)) {
        throw new ConfigurationError({
          message: `Invalid collection route '${collection.route}'. Use letters, digits, '-', '_' and '/'.`,
          code: ErrorCode.CONFIGURATION_ERROR,
        });
      }
      this.moduleFor(collection).prepare(collection);
    }

    for (const collection of this.allCollections) {
      const router = express.Router({ mergeParams: true });
      this.moduleFor(collection).register(router, collection);
      this.app.use(`${config.apiPrefix}/${collection.route}`, router);
      seen.add(collection.route);
    }
    services.logger.debug(
      `Mounted ${seen.size} collections under ${config.apiPrefix}.`,
    );
  }

  private moduleFor(collection: Collection): FeatureModule {
    const module = this.modules.get(collection.type);
    if (!module) {
      throw new ConfigurationError({
        message: `Unknown collection type '${collection.type}' for '${collection.route}'.`,
        hint: `Known types: ${[...this.modules.keys()].join(", ")}. Add your own with forge.use(new MyModule(forge.services)).`,
      });
    }
    return module;
  }

  private corsOptions(): CorsOptions {
    const { config } = this;
    if (config.corsConfig) return config.corsConfig;
    const origins = config.frontendOrigins;
    // Without configured front-end origins, cross-origin browser access is not allowed.
    return origins.length > 0
      ? { origin: [...origins], credentials: true }
      : { origin: false };
  }

  private allowedOrigins(): string[] {
    const configured = this.config.corsConfig?.origin;
    const fromCors = Array.isArray(configured)
      ? configured.filter((o): o is string => typeof o === "string")
      : typeof configured === "string" && configured !== "*"
        ? [configured]
        : [];
    return [...this.config.frontendOrigins, ...fromCors];
  }

  private installSignalHandlers(): void {
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      const handler = () => {
        this.services.logger.info(`${signal} received: shutting down.`);
        this.stop().then(
          () => process.exit(0),
          (error) => {
            this.services.logger.error("Shutdown failed.", {
              error: String(error),
            });
            process.exit(1);
          },
        );
      };
      process.once(signal, handler);
      this.signalHandlers.push([signal, handler]);
    }
  }
}
