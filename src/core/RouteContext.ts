import type { Request, Response } from "express";
import { ZodError, type ZodIssue, type ZodObject, type ZodType } from "zod";
import type { Repository } from "../data/Repository.js";
import type { ActionContext, ActionOperation } from "../types/ActionHandler.js";
import type { Collection } from "../types/Collection.js";
import type { Route } from "../types/Route.js";
import type { Services } from "./Services.js";

/** Everything a handler needs to know about the route it serves. Built once at registration. */
export class RouteContext {
  constructor(
    readonly services: Services,
    readonly collection: Collection,
    /** The route with defaults applied (the developer's object is never mutated). */
    readonly route: Route,
    readonly validator: ZodObject<Record<string, ZodType>> | undefined,
    readonly repository: Repository | undefined,
  ) {}

  get modelName(): string {
    return this.collection.model ?? this.collection.route;
  }

  get label(): string {
    return `${this.route.method.toUpperCase()} ${this.services.config.apiPrefix}/${this.collection.route}${this.route.path}`;
  }

  /** Validated, stripped request body. With no validation configured the route accepts no body fields. */
  parseBody(body: unknown): Record<string, unknown> {
    if (!this.validator) return {};
    return this.validator.parse(body ?? {}) as Record<string, unknown>;
  }

  /**
   * Validates every element of an array body against the route's validation. All problems are collected, each with
   * the position of its item at the start of the path (for example `1.name`), so a client can tell which items to fix.
   */
  parseEach(body: unknown): Record<string, unknown>[] {
    const items = Array.isArray(body) ? body : [];
    const issues: ZodIssue[] = [];
    const parsed = items.map((item, index) => {
      try {
        return this.parseBody(item);
      } catch (error) {
        if (!(error instanceof ZodError)) throw error;
        issues.push(...error.issues.map((issue) => ({ ...issue, path: [index, ...issue.path] }) as ZodIssue));
        return {};
      }
    });
    if (issues.length > 0) throw new ZodError(issues);
    return parsed;
  }

  actionContext(req: Request, operation: ActionOperation, data: ActionContext["data"] = {}): ActionContext {
    return {
      req,
      res: req.res as Response,
      ...(req.user ? { user: req.user } : {}),
      route: this.collection.route,
      operation,
      model: this.modelName,
      repository: this.repository,
      repositoryOf: (model) => this.services.data.repository(model),
      Model: this.services.data.nativeModel?.(this.modelName) as ActionContext["Model"],
      data,
    };
  }
}
