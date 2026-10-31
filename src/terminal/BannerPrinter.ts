import type { ForgeConfig } from "../config/ForgeConfig.js";
import type { Collection } from "../types/Collection.js";
import printBanner from "./banner.js";

/** Prints the start-up banner from the real, resolved configuration. */
export class BannerPrinter {
  constructor(private readonly config: ForgeConfig) {}

  print(collections: readonly Collection[], dbStatus: string, port: number = this.config.port): void {
    const models = new Set(collections.map((c) => c.model).filter(Boolean));
    const routes = collections.reduce((sum, c) => sum + c.routes.length, 0);
    const validators = collections.reduce((sum, c) => sum + Object.keys(c.validations ?? {}).length, 0);
    const routeList = collections.flatMap((c) => c.routes);

    const features = [
      collections.some((c) => c.type === "auth") && "authentication",
      routeList.some((r) => r.auth === "admin" || r.auth === "admin-or-owner") && "authorization",
      collections.some((c) => c.type === "crud") && "autoCrud",
      routeList.some((r) => r.files?.length) && "fileUpload",
      "rateLimiting",
      "errorHandling",
      "cors",
    ].filter((f): f is string => typeof f === "string");

    printBanner({
      env: this.config.env,
      host: "localhost",
      port,
      url: `http://localhost:${port}`,
      apiPrefix: this.config.apiPrefix,
      health: `${this.config.apiPrefix}/health`,
      db: { driver: "MongoDB", name: this.config.databaseName, connected: dbStatus === "Connected", status: dbStatus },
      generated: { models: models.size, validators, routes },
      features,
      resources: [...models].filter((m): m is string => typeof m === "string"),
    });
  }
}
