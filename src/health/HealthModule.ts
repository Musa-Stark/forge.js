import type { Request, Response } from "express";
import { FeatureModule, type HandlerFn } from "../core/FeatureModule.js";
import type { RouteContext } from "../core/RouteContext.js";
import type { AccessLevel } from "../types/Route.js";

/** `type: "health"` collections: liveness and database readiness. */
export class HealthModule extends FeatureModule {
  readonly type = "health";
  private readonly startedAt = Date.now();

  protected handlers(): Readonly<Record<string, HandlerFn>> {
    const respond: HandlerFn = async (req: Request, res: Response, _ctx: RouteContext) => {
      const database = await this.services.data.ping();
      const body = {
        status: database ? "ok" : "degraded",
        method: req.method,
        uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
        database: database ? "up" : "down",
        timestamp: new Date().toISOString(),
      };
      res.status(database ? 200 : 503).json({
        success: database,
        message: database ? "Service is healthy." : "Service is degraded.",
        data: body,
      });
    };
    return {
      healthGet: respond,
      healthPost: respond,
      healthPut: respond,
      healthPatch: respond,
      healthDelete: respond,
    };
  }

  protected override defaultAuth(): AccessLevel {
    return "public";
  }
}
