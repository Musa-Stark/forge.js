import { ZodError } from "zod";
import {
  AppError,
  BadRequestError,
  ConflictError,
  InternalError,
  PayloadTooLargeError,
  ServiceUnavailableError,
  UnauthorizedError,
  UnsupportedMediaTypeError,
  ValidationError,
  type IssueDetail,
} from "./AppError.js";
import { ErrorCode } from "./ErrorCode.js";

interface ErrorLike {
  name?: string;
  message?: string;
  code?: unknown;
  status?: unknown;
  type?: unknown;
  keyPattern?: Record<string, unknown>;
  path?: unknown;
  errors?: Record<string, { message?: string; kind?: string; path?: string }>;
  field?: unknown;
}

const asErrorLike = (error: unknown): ErrorLike =>
  typeof error === "object" && error !== null ? (error as ErrorLike) : {};

/**
 * The field behind a duplicate-key message such as `... index: sku_1 dup key: { sku: "KB-001" }`.
 * Only a single-field index name (`field_1` or `field_-1`) is read. A compound index gives no field.
 */
const fieldsFromIndexName = (message: string | undefined): string[] => {
  const index = /index: (\S+) dup key/.exec(message ?? "")?.[1];
  const field = index ? /^(.+)_-?1$/.exec(index)?.[1] : undefined;
  return field && !/_-?1_/.test(field) ? [field] : [];
};

/**
 * Turns anything that can be thrown inside a request into an {@link AppError}.
 *
 * Third-party libraries (Mongoose, Multer, body-parser, jsonwebtoken, Zod) each
 * fail in their own shape. Centralising the mapping keeps every handler free
 * of `try/catch` noise and guarantees the *right* HTTP status for each case.
 */
export class ErrorTranslator {
  translate(error: unknown): AppError {
    if (error instanceof AppError) return error;
    if (error instanceof ZodError) return this.fromZod(error);

    const e = asErrorLike(error);

    return (
      this.fromBodyParser(e, error) ??
      this.fromMulter(e, error) ??
      this.fromJwt(e, error) ??
      this.fromMongo(e, error) ??
      new InternalError({
        message: "Something went wrong.",
        cause: error,
        code: ErrorCode.INTERNAL_ERROR,
      })
    );
  }

  private fromZod(error: ZodError): ValidationError {
    const issues: IssueDetail[] = error.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message,
      code: issue.code,
    }));
    const first = issues[0];
    return new ValidationError({
      message: first ? `${first.path || "body"}: ${first.message}` : "Invalid input.",
      issues,
      cause: error,
    });
  }

  private fromBodyParser(e: ErrorLike, original: unknown): AppError | undefined {
    if (typeof e.type !== "string") return undefined;

    switch (e.type) {
      case "entity.parse.failed":
        return new BadRequestError({
          message: "Invalid JSON in request body.",
          code: ErrorCode.INVALID_JSON,
          hint: "Send a well-formed JSON document with the 'Content-Type: application/json' header.",
          cause: original,
        });
      case "entity.too.large":
        return new PayloadTooLargeError({
          message: "Request body is too large.",
          hint: "Reduce the size of the request body.",
          cause: original,
        });
      case "charset.unsupported":
      case "encoding.unsupported":
        return new UnsupportedMediaTypeError({
          message: "Unsupported request encoding.",
          code: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
          cause: original,
        });
      case "request.aborted":
      case "request.size.invalid":
        return new BadRequestError({ message: "The request could not be read.", cause: original });
      default:
        return undefined;
    }
  }

  private fromMulter(e: ErrorLike, original: unknown): AppError | undefined {
    if (e.name !== "MulterError" || typeof e.code !== "string") return undefined;

    switch (e.code) {
      case "LIMIT_FILE_SIZE":
        return new PayloadTooLargeError({
          message: "Uploaded file is too large.",
          code: ErrorCode.UPLOAD_TOO_LARGE,
          hint: "Reduce the file size and try again.",
          cause: original,
        });
      case "LIMIT_FILE_COUNT":
        return new BadRequestError({
          message: "Too many files uploaded.",
          code: ErrorCode.UPLOAD_TOO_MANY_FILES,
          hint: "Reduce the number of uploaded files.",
          cause: original,
        });
      case "LIMIT_UNEXPECTED_FILE":
        return new BadRequestError({
          message: `Unexpected file field '${String(e.field)}'.`,
          code: ErrorCode.UPLOAD_FIELD_NOT_FOUND,
          hint: "The field name must match routes -> files -> paramField. For several files set 'multiple: true'.",
          cause: original,
        });
      default:
        return new BadRequestError({
          message: "The multipart request is invalid.",
          code: ErrorCode.UPLOAD_FAILED,
          hint: e.message ?? "Check the upload request.",
          cause: original,
        });
    }
  }

  private fromJwt(e: ErrorLike, original: unknown): AppError | undefined {
    if (e.name === "TokenExpiredError") {
      return new UnauthorizedError({
        message: "The token has expired.",
        code: ErrorCode.ACCESS_TOKEN_EXPIRED,
        cause: original,
      });
    }
    if (e.name === "JsonWebTokenError" || e.name === "NotBeforeError") {
      return new UnauthorizedError({
        message: "The token is invalid.",
        code: ErrorCode.ACCESS_TOKEN_INVALID,
        cause: original,
      });
    }
    return undefined;
  }

  private fromMongo(e: ErrorLike, original: unknown): AppError | undefined {
    // Duplicate key (unique index violation). A single insert or update reports the key pattern. `insertMany`
    // throws a bulk write error instead: it has the code and the server message but no key pattern, so the
    // field is read from the index name in that message when the index covers one field.
    if (e.code === 11000 || e.code === 11001) {
      const fields = typeof e.keyPattern === "object" && e.keyPattern !== null ? Object.keys(e.keyPattern) : fieldsFromIndexName(e.message);
      return new ConflictError({
        message: `An item with this ${fields.join(", ") || "value"} already exists.`,
        code: ErrorCode.DUPLICATE_KEY,
        ...(fields.length > 0
          ? { details: { fields }, hint: `'${fields.join("', '")}' is declared unique in the schema.` }
          : {}),
        cause: original,
      });
    }

    // Invalid ObjectId / bad type in a query
    if (e.name === "CastError") {
      return new BadRequestError({
        message: `Invalid value for '${String(e.path)}'.`,
        code: ErrorCode.INVALID_OBJECT_ID,
        cause: original,
      });
    }

    // Schema validation failure
    if (e.name === "ValidationError" && e.errors && typeof e.errors === "object") {
      const issues: IssueDetail[] = Object.entries(e.errors).map(([path, detail]) => ({
        path,
        message: detail.message ?? "Invalid value",
        ...(detail.kind ? { code: detail.kind } : {}),
      }));
      const first = issues[0];
      return new ValidationError({
        message: first ? `${first.path}: ${first.message}` : "Invalid input.",
        issues,
        cause: original,
      });
    }

    // Connectivity problems
    if (
      e.name === "MongoNetworkError" ||
      e.name === "MongoServerSelectionError" ||
      e.name === "MongooseServerSelectionError" ||
      e.name === "MongoNotConnectedError"
    ) {
      return new ServiceUnavailableError({
        message: "The database is currently unavailable.",
        code: ErrorCode.DATABASE_UNAVAILABLE,
        cause: original,
      });
    }

    return undefined;
  }
}
