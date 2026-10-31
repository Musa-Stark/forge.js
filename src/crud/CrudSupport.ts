import type { Request } from "express";
import { BadRequestError, ConfigurationError, ErrorCode, NotFoundError } from "../errors/index.js";
import type { Doc, PopulateOption, Repository } from "../data/Repository.js";
import type { RouteContext } from "../core/RouteContext.js";
import type { Services } from "../core/Services.js";
import { parseFieldSpec } from "../core/FieldTransformer.js";
import type { StoredFile } from "../upload/UploadService.js";
import type { UploadProvider } from "../types/upload.js";
import { isObjectId } from "../utils/ids.js";

/** Small helpers shared by the CRUD and file controllers. */
export class CrudSupport {
  constructor(private readonly services: Services) {}

  repo(ctx: RouteContext): Repository {
    if (!ctx.repository) {
      throw new ConfigurationError({
        message: `The '${ctx.collection.route}' collection needs a 'model' and a 'schema'.`,
      });
    }
    return ctx.repository;
  }

  /** The `:id` URL parameter, validated as an ObjectId. */
  id(req: Request): string {
    const id = req.params.id;
    if (!isObjectId(id)) {
      throw new BadRequestError({ message: "The id in the URL is not valid.", code: ErrorCode.INVALID_OBJECT_ID });
    }
    return id;
  }

  populate(ctx: RouteContext): PopulateOption | undefined {
    const path = ctx.route.config?.populate;
    if (!path) return undefined;
    // Only ids are returned by default so referenced documents never leak e-mails or other personal data.
    return { path, select: ctx.route.config?.populateSelect ?? "_id" };
  }

  /** Loads a document the caller is allowed to see, or throws 404 / 403. */
  async load(ctx: RouteContext, req: Request): Promise<Doc> {
    const doc = await this.repo(ctx).findById(this.id(req), { populate: this.populate(ctx) });
    if (!doc) throw this.notFound(ctx);
    this.services.access.assertCanAccess(ctx.route, req.user, doc);
    return doc;
  }

  notFound(ctx: RouteContext): NotFoundError {
    return new NotFoundError({ message: `${ctx.modelName} not found.`, code: ErrorCode.RESOURCE_NOT_FOUND });
  }

  /**
   * Fields hashed by *any* route of the collection. They are write-only: a hash must not be
   * returned by sibling routes (e.g. a list route) just because they do not declare it.
   */
  hashedFields(ctx: RouteContext): string[] {
    return ctx.collection.routes.flatMap((r) => (r.hashedFields ?? []).map((f) => f.replace(/\?$/, "")));
  }

  /** Decrypts requested fields and removes everything private. */
  async present(ctx: RouteContext, doc: Doc): Promise<Record<string, unknown>> {
    const hiddenFields = [...(ctx.route.config?.hiddenFields ?? []), ...this.hashedFields(ctx)];
    // A hidden field is never returned, so it is not decrypted either, even when the route lists it in `decryptedFields`.
    const decryptable = (ctx.route.decryptedFields ?? []).filter((spec) => !hiddenFields.includes(parseFieldSpec(spec).name));
    const plain = await this.services.transformer.decrypt(doc, decryptable);
    const clean = this.services.sanitizer.one(doc, { hiddenFields });
    return { ...clean, ...plain };
  }

  async presentMany(ctx: RouteContext, docs: readonly Doc[]): Promise<Record<string, unknown>[]> {
    return Promise.all(docs.map((doc) => this.present(ctx, doc)));
  }

  /**
   * Fields clients may sort by. The order of a list reveals how the values compare, so a client may only
   * sort by fields it could read anyway: secrets (`select: false`), fields hashed or encrypted by any route of
   * the collection, and fields this route hides are all excluded.
   */
  sortable(ctx: RouteContext): string[] {
    const bare = (names: readonly string[] | undefined): string[] => (names ?? []).map((f) => f.replace(/\?$/, ""));
    const schema = ctx.collection.schema;
    const blocked = new Set([
      ...(schema ? this.services.compiler.secretFieldsOf(schema) : []),
      ...ctx.collection.routes.flatMap((r) => [...bare(r.encryptedFields), ...bare(r.hashedFields)]),
      ...bare(ctx.route.config?.hiddenFields),
    ]);
    return Object.keys(schema ?? {}).filter((f) => !blocked.has(f));
  }

  /** Every file field a collection declares across all its routes. */
  fileFields(ctx: RouteContext): Array<{ field: string; provider: UploadProvider | undefined }> {
    const seen = new Map<string, UploadProvider | undefined>();
    for (const route of ctx.collection.routes) {
      for (const file of route.files ?? []) seen.set(file.schemaField, file.provider);
    }
    return [...seen].map(([field, provider]) => ({ field, provider }));
  }

  /** Stored files referenced by a document, ready for cleanup. */
  filesOf(ctx: RouteContext, doc: Doc): Array<{ file: StoredFile; provider: UploadProvider | undefined }> {
    return this.fileFields(ctx).flatMap(({ field, provider }) => {
      const value = doc[field];
      const list = Array.isArray(value) ? value : [];
      return list
        .filter((f): f is StoredFile => typeof f === "object" && f !== null && typeof f.storageKey === "string" && f.storageKey !== "")
        .map((file) => ({ file, provider }));
    });
  }
}
