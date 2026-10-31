import type { Request, Response } from "express";
import { BadRequestError, ConflictError, ErrorCode, NotFoundError } from "../errors/index.js";
import type { RouteContext } from "../core/RouteContext.js";
import type { Services } from "../core/Services.js";
import type { Upload } from "../types/upload.js";
import { idToString, isObjectId } from "../utils/ids.js";
import { CrudSupport } from "./CrudSupport.js";

type FileEntry = { _id?: unknown; storageKey?: string };

/** `addFile`, `updateFile` and `deleteFile`: manage the files attached to one document. */
export class FileController {
  private readonly support: CrudSupport;

  constructor(private readonly services: Services) {
    this.support = new CrudSupport(services);
  }

  addFile = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    await this.services.actions.runBefore(ctx.route.actions?.before, ctx.actionContext(req, "addFile"));
    const uploads = this.uploadsOf(ctx);
    const doc = await this.support.load(ctx, req);
    const stored = await this.services.uploads.store(req, uploads, { requireAll: true });

    try {
      const changes: Record<string, unknown> = {};
      for (const upload of uploads) {
        const current = this.list(doc[upload.schemaField]);
        const added = stored[upload.schemaField] ?? [];
        const limit = upload.multiple ? this.services.config.upload.maxFiles : 1;
        if (current.length + added.length > limit) {
          throw new ConflictError({
            message: upload.multiple
              ? `'${upload.schemaField}' can hold at most ${limit} files.`
              : `'${upload.schemaField}' already has a file.`,
            hint: upload.multiple ? "Delete a file first." : "Use the updateFile route to replace it.",
          });
        }
        changes[upload.schemaField] = [...current, ...added];
      }
      const updated = await this.support.repo(ctx).updateById(doc._id, changes);
      if (!updated) throw this.support.notFound(ctx);
      await this.respond(req, res, ctx, "addFile", updated, "File added successfully.", stored);
    } catch (error) {
      await this.services.uploads.discard(this.services.uploads.flatten(stored).map((file) => ({ file, provider: uploads[0]?.provider })));
      throw error;
    }
  };

  updateFile = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    await this.services.actions.runBefore(ctx.route.actions?.before, ctx.actionContext(req, "updateFile"));
    const [upload] = this.uploadsOf(ctx, 1) as [Upload];
    const fileId = this.fileId(req, upload);
    const doc = await this.support.load(ctx, req);

    const current = this.list(doc[upload.schemaField]);
    const index = current.findIndex((f) => idToString(f._id) === fileId);
    if (index === -1) throw this.fileNotFound(upload);

    const stored = await this.services.uploads.store(req, [upload], { requireAll: true });
    const replacement = stored[upload.schemaField]?.[0];
    try {
      const next = [...current];
      next[index] = replacement as FileEntry;
      const updated = await this.support.repo(ctx).updateById(doc._id, { [upload.schemaField]: next });
      if (!updated) throw this.support.notFound(ctx);

      const old = current[index];
      if (old?.storageKey) await this.services.uploads.discard([{ file: old as never, provider: upload.provider }]);
      await this.respond(req, res, ctx, "updateFile", updated, "File updated successfully.", stored);
    } catch (error) {
      await this.services.uploads.discard(this.services.uploads.flatten(stored).map((file) => ({ file, provider: upload.provider })));
      throw error;
    }
  };

  deleteFile = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    await this.services.actions.runBefore(ctx.route.actions?.before, ctx.actionContext(req, "deleteFile"));
    const [upload] = this.uploadsOf(ctx, 1) as [Upload];
    const fileId = this.fileId(req, upload);
    const doc = await this.support.load(ctx, req);

    const current = this.list(doc[upload.schemaField]);
    const target = current.find((f) => idToString(f._id) === fileId);
    if (!target) throw this.fileNotFound(upload);

    const updated = await this.support.repo(ctx).updateById(doc._id, {
      [upload.schemaField]: current.filter((f) => f !== target),
    });
    if (!updated) throw this.support.notFound(ctx);

    if (target.storageKey) await this.services.uploads.discard([{ file: target as never, provider: upload.provider }]);
    await this.respond(req, res, ctx, "deleteFile", updated, "File deleted successfully.");
  };

  private async respond(
    req: Request,
    res: Response,
    ctx: RouteContext,
    operation: "addFile" | "updateFile" | "deleteFile",
    doc: Parameters<CrudSupport["present"]>[1],
    message: string,
    stored: Record<string, unknown> = {},
  ): Promise<void> {
    const item = await this.support.present(ctx, doc);
    const replaced = await this.services.actions.runAfter(
      ctx.route.actions?.after,
      { ...ctx.actionContext(req, operation, { files: stored }), item, result: item },
    );
    this.services.responses.success(res, { message, data: replaced ?? item });
  }

  private uploadsOf(ctx: RouteContext, exactly?: number): Upload[] {
    const uploads = ctx.route.files ?? [];
    if (uploads.length === 0 || (exactly !== undefined && uploads.length !== exactly)) {
      throw new BadRequestError({
        message: `${ctx.label} needs ${exactly === 1 ? "exactly one" : "at least one"} entry in 'files'.`,
        code: ErrorCode.CONFIGURATION_ERROR,
      });
    }
    return uploads;
  }

  private fileId(req: Request, upload: Upload): string {
    const key = upload.validationKey ?? "fileId";
    const value = (req.body as Record<string, unknown> | undefined)?.[key];
    if (!isObjectId(value)) {
      throw new BadRequestError({ message: `'${key}' must be the id of a stored file.`, code: ErrorCode.INVALID_OBJECT_ID });
    }
    return value;
  }

  private list(value: unknown): FileEntry[] {
    return Array.isArray(value) ? (value as FileEntry[]) : [];
  }

  private fileNotFound(upload: Upload): NotFoundError {
    return new NotFoundError({ message: `No such file in '${upload.schemaField}'.`, code: ErrorCode.FILE_NOT_FOUND });
  }
}
