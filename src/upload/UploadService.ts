import multer from "multer";
import type { Request, RequestHandler } from "express";
import type { ForgeConfig } from "../config/ForgeConfig.js";
import { BadRequestError, ConfigurationError, ErrorCode, UnsupportedMediaTypeError } from "../errors/index.js";
import type { StoreFile } from "../types/StoreFile.js";
import type { Upload, UploadProvider, UploadType } from "../types/upload.js";
import type { Logger } from "../utils/Logger.js";
import { newObjectId } from "../utils/ids.js";
import { FileTypeSniffer } from "./FileTypeSniffer.js";
import type { IncomingFile, StorageProvider } from "./StorageProvider.js";

const DEFAULT_ALLOWED: Record<UploadType, readonly string[]> = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  raw: ["application/pdf"],
};

/** A stored file as persisted in a document: metadata plus its own id. */
export type StoredFile = StoreFile & { _id: string };

/** Result of storing the files of one request: schema field -> files (file fields are always arrays). */
export type StoredFiles = Record<string, StoredFile[]>;

/** Receives, verifies and stores uploaded files. */
export class UploadService {
  private readonly providers = new Map<UploadProvider, StorageProvider>();

  constructor(
    private readonly config: ForgeConfig,
    private readonly logger: Logger,
    providers: StorageProvider[] = [],
    private readonly sniffer = new FileTypeSniffer(),
  ) {
    for (const provider of providers) this.providers.set(provider.name, provider);
  }

  register(provider: StorageProvider): void {
    this.providers.set(provider.name, provider);
  }

  provider(name: UploadProvider = "cloudinary"): StorageProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new ConfigurationError({
        message: `The '${name}' storage provider is not available.`,
        hint: name === "cloudinary" ? "Set the cloudinary* options." : "Only 'cloudinary' ships with Forge; register your own StorageProvider.",
      });
    }
    return provider;
  }

  allowedMimeTypes(upload: Upload): readonly string[] {
    return upload.allowedMimeTypes ?? DEFAULT_ALLOWED[upload.type ?? "image"];
  }

  /** Multer middleware that parses the multipart fields declared by a route (memory storage, size limited). */
  parser(uploads: Upload[]): RequestHandler {
    const byField = new Map(uploads.map((u) => [u.paramField, u]));
    const middleware = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: this.config.upload.maxFileSize, files: this.config.upload.maxFiles, fields: 50, parts: 100 },
      fileFilter: (_req, file, cb) => {
        const upload = byField.get(file.fieldname);
        if (!upload) return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
        if (!this.allowedMimeTypes(upload).includes(file.mimetype)) {
          return cb(
            new UnsupportedMediaTypeError({
              message: `'${file.mimetype}' files are not allowed for '${file.fieldname}'.`,
              code: ErrorCode.UPLOAD_INVALID_TYPE,
              hint: `Allowed: ${this.allowedMimeTypes(upload).join(", ")}.`,
            }),
          );
        }
        cb(null, true);
      },
    }).fields(uploads.map((u) => ({ name: u.paramField, maxCount: u.multiple ? this.config.upload.maxFiles : 1 })));
    return middleware;
  }

  /** Files multer put on the request, grouped by field. */
  filesOf(req: Request): Record<string, IncomingFile[]> {
    const files = req.files;
    if (!files || Array.isArray(files)) return {};
    return files as Record<string, IncomingFile[]>;
  }

  /** Verifies the bytes of every file, uploads them, and returns their metadata. Nothing is stored if any file is bad. */
  async store(req: Request, uploads: Upload[], options: { requireAll?: boolean } = {}): Promise<StoredFiles> {
    const incoming = this.filesOf(req);

    // Validate everything first so we never store a partial request.
    for (const upload of uploads) {
      const files = incoming[upload.paramField] ?? [];
      if (files.length === 0 && options.requireAll) {
        throw new BadRequestError({
          message: `A file is required in the '${upload.paramField}' field.`,
          code: ErrorCode.UPLOAD_REQUIRED,
          hint: "Send the request as multipart/form-data.",
        });
      }
      for (const file of files) this.verifyContent(file, upload);
    }

    const stored: StoredFiles = {};
    const done: Array<{ upload: Upload; file: StoredFile }> = [];
    try {
      for (const upload of uploads) {
        const files = incoming[upload.paramField] ?? [];
        if (files.length === 0) continue;
        const storage = this.provider(upload.provider);
        const results: StoredFile[] = [];
        for (const file of files) {
          const result = { _id: newObjectId(), ...(await storage.upload(file, { type: upload.type ?? "image" })) };
          done.push({ upload, file: result });
          results.push(result);
        }
        stored[upload.schemaField] = [...(stored[upload.schemaField] ?? []), ...results];
      }
    } catch (error) {
      await this.discard(done.map((d) => ({ file: d.file, provider: d.upload.provider })));
      throw error;
    }
    return stored;
  }

  /** Best-effort removal of stored files. Never throws: used for cleanup paths. */
  async discard(items: Array<{ file: Pick<StoreFile, "storageKey" | "resourceType">; provider?: UploadProvider | undefined }>): Promise<void> {
    await Promise.all(
      items.map(async ({ file, provider }) => {
        try {
          await this.provider(provider).remove(file);
        } catch (error) {
          this.logger.warn("Could not remove a stored file.", { storageKey: file.storageKey, error: String(error) });
        }
      }),
    );
  }

  flatten(stored: StoredFiles): StoredFile[] {
    return Object.values(stored).flat();
  }

  private verifyContent(file: IncomingFile, upload: Upload): void {
    const allowed = this.allowedMimeTypes(upload);
    const type = upload.type ?? "image";
    const real = this.sniffer.sniff(file.buffer);

    if (real) {
      if (!allowed.includes(real)) {
        throw new UnsupportedMediaTypeError({
          message: `The content of '${file.originalname}' does not match an allowed file type.`,
          code: ErrorCode.UPLOAD_INVALID_TYPE,
        });
      }
      return;
    }
    // Images and videos must always be recognisable; only "raw" text-like files may go unsniffed.
    if (type !== "raw") {
      throw new UnsupportedMediaTypeError({
        message: `'${file.originalname}' is not a valid ${type} file.`,
        code: ErrorCode.UPLOAD_INVALID_TYPE,
      });
    }
  }
}
