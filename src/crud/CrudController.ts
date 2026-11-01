import type { Request, Response } from "express";
import { BadRequestError, ErrorCode } from "../errors/index.js";
import type { RouteContext } from "../core/RouteContext.js";
import type { Services } from "../core/Services.js";
import type { Doc, Filter } from "../data/Repository.js";
import { referenceOf } from "../data/references.js";
import type { Collection } from "../types/Collection.js";
import type { Route } from "../types/Route.js";
import { isObjectId } from "../utils/ids.js";
import { CrudSupport } from "./CrudSupport.js";

const DEFAULT_MAX_BULK = 100;
const MAX_BATCH_DELETE = 100;

/** The eight database handlers: read, readAll, create, createBulk, update, remove, removeMultiple, removeAll. */
export class CrudController {
  private readonly support: CrudSupport;

  constructor(private readonly services: Services) {
    this.support = new CrudSupport(services);
  }

  read = async (
    req: Request,
    res: Response,
    ctx: RouteContext,
  ): Promise<void> => {
    await this.services.actions.runBefore(
      ctx.route.actions?.before,
      ctx.actionContext(req, "read"),
    );

    const doc = await this.support.load(ctx, req);
    const item = await this.support.present(ctx, doc);

    const response = {
      success: true,
      message: `${ctx.modelName} fetched successfully.`,
      data: item,
    };
    const replaced = await this.services.actions.runAfter(
      ctx.route.actions?.after,
      { ...ctx.actionContext(req, "read"), item, result: response },
    );
    this.services.responses.success(res, { ...response, data: replaced ?? response.data });
  };

  readAll = async (
    req: Request,
    res: Response,
    ctx: RouteContext,
  ): Promise<void> => {
    await this.services.actions.runBefore(
      ctx.route.actions?.before,
      ctx.actionContext(req, "readAll"),
    );

    const repo = this.support.repo(ctx);
    const page = this.services.pagination.parse(
      req,
      this.support.sortable(ctx),
    );
    const filter = this.services.access.scopeFilter(ctx.route, req.user);

    const [docs, total] = await Promise.all([
      repo.find(filter, {
        populate: this.support.populate(ctx),
        sort: page.sort,
        skip: page.skip,
        limit: page.limit,
      }),
      repo.count(filter),
    ]);
    const items = await this.support.presentMany(ctx, docs);

    const response = {
      success: true,
      message: `${ctx.modelName} list fetched successfully.`,
      data: items,
      meta: this.services.pagination.meta(page, total),
    };
    const replaced = await this.services.actions.runAfter(
      ctx.route.actions?.after,
      { ...ctx.actionContext(req, "readAll"), item: items, result: response },
    );
    this.services.responses.success(res, { ...response, data: replaced ?? response.data });
  };

  create = async (
    req: Request,
    res: Response,
    ctx: RouteContext,
  ): Promise<void> => {
    const beforeResult = await this.services.actions.runBefore(
      ctx.route.actions?.before,
      ctx.actionContext(req, "create"),
    );

    if (
      beforeResult !== undefined &&
      typeof beforeResult === "object" &&
      beforeResult !== null &&
      !Array.isArray(beforeResult)
    ) {
      req.body = {
        ...req.body,
        ...beforeResult,
      };
    }

    let body = this.services.access.writableBody(
      ctx.parseBody(req.body),
      req.user,
    );
    const stored = ctx.route.files?.length
      ? await this.services.uploads.store(req, ctx.route.files)
      : {};
    body = { ...body, ...stored };

    try {
      const encrypted = await this.services.transformer.encrypt(
        body,
        ctx.route.encryptedFields,
      );
      const hashed = await this.services.transformer.hash(
        encrypted,
        ctx.route.hashedFields,
      );
      const doc = await this.support
        .repo(ctx)
        .create(this.withOwner(ctx, hashed, req));
      const item = await this.support.present(ctx, doc);

      const response = { success: true, message: `${ctx.modelName} created successfully.`, data: item };
      const replaced = await this.services.actions.runAfter(
        ctx.route.actions?.after,
        {
          ...ctx.actionContext(req, "create", { body, files: stored }),
          item,
          result: response,
        },
      );
      this.services.responses.created(res, { ...response, data: replaced ?? response.data });
    } catch (error) {
      await this.discardStored(ctx, stored);
      throw error;
    }
  };

  createBulk = async (
    req: Request,
    res: Response,
    ctx: RouteContext,
  ): Promise<void> => {
    await this.services.actions.runBefore(
      ctx.route.actions?.before,
      ctx.actionContext(req, "createBulk"),
    );

    if (!Array.isArray(req.body) || req.body.length === 0) {
      throw new BadRequestError({
        message: "Send a non-empty JSON array.",
        code: ErrorCode.BAD_REQUEST,
      });
    }
    const max = ctx.route.config?.maxBulkSize ?? DEFAULT_MAX_BULK;
    if (req.body.length > max) {
      throw new BadRequestError({
        message: `You can create at most ${max} items at once.`,
        code: ErrorCode.BAD_REQUEST,
      });
    }

    const rows: Record<string, unknown>[] = [];
    for (const parsed of ctx.parseEach(req.body)) {
      const writable = this.services.access.writableBody(parsed, req.user);
      const encrypted = await this.services.transformer.encrypt(
        writable,
        ctx.route.encryptedFields,
      );
      const hashed = await this.services.transformer.hash(
        encrypted,
        ctx.route.hashedFields,
      );
      rows.push(this.withOwner(ctx, hashed, req));
    }

    const docs = await this.support.repo(ctx).createMany(rows);
    const items = await this.support.presentMany(ctx, docs);

    const response = { success: true, message: `${items.length} ${ctx.modelName} items created successfully.`, data: items };
    const replaced = await this.services.actions.runAfter(
      ctx.route.actions?.after,
      { ...ctx.actionContext(req, "createBulk"), item: items, result: response },
    );
    this.services.responses.created(res, { ...response, data: replaced ?? response.data });
  };

  update = async (
    req: Request,
    res: Response,
    ctx: RouteContext,
  ): Promise<void> => {
    await this.services.actions.runBefore(
      ctx.route.actions?.before,
      ctx.actionContext(req, "update"),
    );

    const existing = await this.support.load(ctx, req);

    let body = this.services.access.writableBody(
      ctx.parseBody(req.body),
      req.user,
    );
    const stored = ctx.route.files?.length
      ? await this.services.uploads.store(req, ctx.route.files)
      : {};
    body = { ...body, ...stored };

    try {
      const encrypted = await this.services.transformer.encrypt(
        body,
        ctx.route.encryptedFields,
      );
      const hashed = await this.services.transformer.hash(
        encrypted,
        ctx.route.hashedFields,
      );
      const updated = await this.support
        .repo(ctx)
        .updateById(existing._id, hashed);
      if (!updated) throw this.support.notFound(ctx);

      // Files that were replaced are no longer referenced: remove them from storage.
      const replacedFields = new Set(Object.keys(stored));
      await this.services.uploads.discard(
        this.support
          .filesOf(ctx, existing)
          .filter(
            ({ file }) =>
              replacedFields.size > 0 &&
              this.isReplaced(existing, replacedFields, file.storageKey),
          ),
      );

      const item = await this.support.present(ctx, updated);
      const response = { success: true, message: `${ctx.modelName} updated successfully.`, data: item };
      const replaced = await this.services.actions.runAfter(
        ctx.route.actions?.after,
        {
          ...ctx.actionContext(req, "update", { body, files: stored }),
          item,
          result: response,
        },
      );
      this.services.responses.success(res, { ...response, data: replaced ?? response.data });
    } catch (error) {
      await this.discardStored(ctx, stored);
      throw error;
    }
  };

  remove = async (
    req: Request,
    res: Response,
    ctx: RouteContext,
  ): Promise<void> => {
    await this.services.actions.runBefore(
      ctx.route.actions?.before,
      ctx.actionContext(req, "remove"),
    );

    const existing = await this.support.load(ctx, req);
    const removed = await this.support.repo(ctx).deleteById(existing._id);
    if (!removed) throw this.support.notFound(ctx);

    await this.services.uploads.discard(this.support.filesOf(ctx, removed));
    const item = await this.support.present(ctx, removed);

    const response = { success: true, message: `${ctx.modelName} deleted successfully.`, data: item };
    const replaced = await this.services.actions.runAfter(
      ctx.route.actions?.after,
      { ...ctx.actionContext(req, "remove"), item, result: response },
    );
    this.services.responses.success(res, { ...response, data: replaced ?? response.data });
  };

  removeMultiple = async (
    req: Request,
    res: Response,
    ctx: RouteContext,
  ): Promise<void> => {
    await this.services.actions.runBefore(
      ctx.route.actions?.before,
      ctx.actionContext(req, "removeMultiple"),
    );

    const field = ctx.route.config?.targetField ?? "ids";
    const ids: unknown = (req.body as Record<string, unknown> | undefined)?.[
      field
    ];
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > MAX_BATCH_DELETE ||
      !ids.every(isObjectId)
    ) {
      throw new BadRequestError({
        message: `'${field}' must be an array of 1-${MAX_BATCH_DELETE} valid ids.`,
        code: ErrorCode.INVALID_OBJECT_ID,
      });
    }

    const repo = this.support.repo(ctx);
    const filter = {
      ...this.services.access.scopeFilter(ctx.route, req.user),
      _id: { $in: [...new Set(ids)] },
    };
    const docs = await this.documentsWithFiles(ctx, filter);
    const deleted = await repo.deleteMany(filter);
    await this.services.uploads.discard(
      docs.flatMap((doc) => this.support.filesOf(ctx, doc)),
    );

    const item = { deleted };
    const response = { success: true, message: `${deleted} ${ctx.modelName} items deleted.`, data: item };
    const replaced = await this.services.actions.runAfter(
      ctx.route.actions?.after,
      {
        ...ctx.actionContext(req, "removeMultiple"),
        item,
        result: response,
      },
    );
    this.services.responses.success(res, { ...response, data: replaced ?? response.data });
  };

  removeAll = async (
    req: Request,
    res: Response,
    ctx: RouteContext,
  ): Promise<void> => {
    await this.services.actions.runBefore(
      ctx.route.actions?.before,
      ctx.actionContext(req, "removeAll"),
    );

    const repo = this.support.repo(ctx);
    const filter = this.services.access.scopeFilter(ctx.route, req.user);
    const docs = await this.documentsWithFiles(ctx, filter);
    const deleted = await repo.deleteMany(filter);
    await this.services.uploads.discard(
      docs.flatMap((doc) => this.support.filesOf(ctx, doc)),
    );

    const item = { deleted };
    const response = { success: true, message: `${deleted} ${ctx.modelName} items deleted.`, data: item };
    const replaced = await this.services.actions.runAfter(
      ctx.route.actions?.after,
      {
        ...ctx.actionContext(req, "removeAll"),
        item,
        result: response,
      },
    );
    this.services.responses.success(res, { ...response, data: replaced ?? response.data });
  };

  /** Startup check: `removeAll` on an open route would let anyone empty the collection. */
  assertSafeRoute(route: RouteContext["route"]): string[] {
    if (
      route.handler === "removeAll" &&
      (route.auth === "public" || route.auth === "authenticated")
    ) {
      return [
        "'removeAll' must use auth 'admin' or 'admin-or-owner' - otherwise any caller could wipe the whole collection.",
      ];
    }
    return [];
  }

  /**
   * Startup check for `config.populate` and `config.populateSelect`. A name that is not a reference would only fail on
   * the first request, as a generic 500 from Mongoose, and a `populateSelect` that lists what to leave out (or nothing)
   * would return every field of the referenced documents, including fields added to their schema later.
   */
  assertPopulate(collection: Collection, route: Route): string[] {
    const { populate, populateSelect } = route.config ?? {};
    if (populate === undefined || populate === false) return [];

    const names =
      typeof populate === "string" ? populate.split(/\s+/).filter(Boolean) : [];
    if (names.length === 0)
      return [
        "'populate' must be the name of a field of the schema (or false).",
      ];

    const problems: string[] = [];
    const schema = collection.schema ?? {};
    for (const name of names) {
      const [head = ""] = name.split(".");
      if (!(head in schema)) {
        problems.push(
          `'populate' names '${name}', which is not a field of the schema.`,
        );
        continue;
      }
      if (name.includes(".")) continue; // a path inside a subdocument: Mongoose resolves it
      const reference = referenceOf(schema[head]);
      if (!reference) {
        problems.push(
          `'populate' names '${name}', which is not a reference. Declare it with a ref, for example { type: "ObjectId", ref: "User" }.`,
        );
      } else if (
        typeof reference.ref === "string" &&
        !this.services.data.has(reference.ref)
      ) {
        problems.push(
          `'populate' names '${name}', which refers to the model '${reference.ref}'. No collection or sign-in configuration declares a model with that name.`,
        );
      }
    }

    if (populateSelect !== undefined) {
      const fieldNames =
        typeof populateSelect === "string"
          ? populateSelect.split(/\s+/).filter(Boolean)
          : [];
      if (fieldNames.length === 0) {
        problems.push(
          "'populateSelect' must list the fields to return, for example \"_id name\". Empty, it would return every field.",
        );
      } else if (
        fieldNames.some((f) => f.startsWith("-") || f.startsWith("+"))
      ) {
        problems.push(
          "'populateSelect' lists the fields to return. A name that starts with '-' or '+' is not allowed, because leaving fields out would expose every field added later.",
        );
      }
    }
    return problems;
  }

  private withOwner(
    ctx: RouteContext,
    data: Record<string, unknown>,
    req: Request,
  ): Record<string, unknown> {
    // The owner always comes from the session, never from the request body.
    const ownerField = this.services.config.auth.ownerField;
    return ctx.collection.schema && ownerField in ctx.collection.schema
      ? { ...data, ...this.services.access.ownerStamp(req.user) }
      : data;
  }

  /**
   * The documents a batch delete is about to remove, loaded only when the collection stores files that must be
   * removed with them. Without file fields nothing needs the documents, so `removeAll` no longer reads a whole
   * collection into memory just to delete it.
   */
  private async documentsWithFiles(
    ctx: RouteContext,
    filter: Filter,
  ): Promise<Doc[]> {
    return this.support.fileFields(ctx).length > 0
      ? [...(await this.support.repo(ctx).find(filter))]
      : [];
  }

  private async discardStored(
    ctx: RouteContext,
    stored: Awaited<ReturnType<Services["uploads"]["store"]>>,
  ): Promise<void> {
    const providers = new Map(
      (ctx.route.files ?? []).map((f) => [f.schemaField, f.provider]),
    );
    await this.services.uploads.discard(
      Object.entries(stored).flatMap(([field, files]) =>
        files.map((file) => ({ file, provider: providers.get(field) })),
      ),
    );
  }

  private isReplaced(
    existing: Doc,
    replacedFields: Set<string>,
    storageKey: string,
  ): boolean {
    return [...replacedFields].some((field) => {
      const list = existing[field];
      return (
        Array.isArray(list) &&
        list.some((f: { storageKey?: string }) => f.storageKey === storageKey)
      );
    });
  }
}
