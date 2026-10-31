import { ErrorCode } from "./ErrorCode.js";

/** A single field-level problem, used by {@link ValidationError}. */
export interface IssueDetail {
  path: string;
  message: string;
  code?: string;
}

export interface AppErrorOptions {
  message: string;
  statusCode?: number;
  code?: ErrorCode | (string & {});
  /** Developer-facing advice. Only exposed outside production. */
  hint?: string;
  /** Extra structured data (never put secrets here). */
  details?: Record<string, unknown>;
  /**
   * Operational errors are expected failures (bad input, missing auth...) whose
   * message is safe to show to the client. Non-operational errors are bugs.
   */
  isOperational?: boolean;
  cause?: unknown;
  /** Response headers to attach (e.g. `Retry-After`). */
  headers?: Record<string, string>;
}

/**
 * Base class for every error Forge raises on purpose.
 *
 * Throw one of the subclasses below instead of building raw `AppError`s so the
 * status code and error code stay consistent across the framework.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly hint: string | undefined;
  readonly details: Record<string, unknown> | undefined;
  readonly isOperational: boolean;
  readonly headers: Record<string, string> | undefined;

  constructor(options: AppErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? ErrorCode.INTERNAL_ERROR;
    this.hint = options.hint;
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;
    this.headers = options.headers;
    Error.captureStackTrace?.(this, new.target);
  }
}

type SubclassOptions = Omit<AppErrorOptions, "statusCode"> & { code?: AppErrorOptions["code"] };

export class BadRequestError extends AppError {
  constructor(options: SubclassOptions) {
    super({ code: ErrorCode.BAD_REQUEST, ...options, statusCode: 400 });
  }
}

export class ValidationError extends AppError {
  readonly issues: readonly IssueDetail[];

  constructor(options: SubclassOptions & { issues?: readonly IssueDetail[] }) {
    const { issues, ...rest } = options;
    super({ code: ErrorCode.VALIDATION_FAILED, ...rest, statusCode: 422 });
    this.issues = issues ?? [];
  }
}

export class UnauthorizedError extends AppError {
  constructor(options: SubclassOptions) {
    super({ code: ErrorCode.ACCESS_TOKEN_INVALID, ...options, statusCode: 401 });
  }
}

export class ForbiddenError extends AppError {
  constructor(options: SubclassOptions) {
    super({ code: ErrorCode.FORBIDDEN, ...options, statusCode: 403 });
  }
}

export class NotFoundError extends AppError {
  constructor(options: SubclassOptions) {
    super({ code: ErrorCode.RESOURCE_NOT_FOUND, ...options, statusCode: 404 });
  }
}

export class ConflictError extends AppError {
  constructor(options: SubclassOptions) {
    super({ code: ErrorCode.CONFLICT, ...options, statusCode: 409 });
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(options: SubclassOptions) {
    super({ code: ErrorCode.PAYLOAD_TOO_LARGE, ...options, statusCode: 413 });
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(options: SubclassOptions) {
    super({ code: ErrorCode.UNSUPPORTED_MEDIA_TYPE, ...options, statusCode: 415 });
  }
}

export class TooManyRequestsError extends AppError {
  constructor(options: SubclassOptions) {
    super({ code: ErrorCode.RATE_LIMITED, ...options, statusCode: 429 });
  }
}

/** The framework or the application was configured incorrectly. A developer must fix it. */
export class ConfigurationError extends AppError {
  constructor(options: SubclassOptions) {
    super({
      code: ErrorCode.CONFIGURATION_ERROR,
      isOperational: false,
      ...options,
      statusCode: 500,
    });
  }
}

/** An upstream service (e.g. an OAuth provider) failed or answered nonsense. */
export class BadGatewayError extends AppError {
  constructor(options: SubclassOptions) {
    super({ code: ErrorCode.SERVICE_UNAVAILABLE, ...options, statusCode: 502 });
  }
}

/** A dependency (database, e-mail provider, storage) is unavailable. */
export class ServiceUnavailableError extends AppError {
  constructor(options: SubclassOptions) {
    super({ code: ErrorCode.SERVICE_UNAVAILABLE, ...options, statusCode: 503 });
  }
}

export class InternalError extends AppError {
  constructor(options: SubclassOptions) {
    super({
      code: ErrorCode.INTERNAL_ERROR,
      isOperational: false,
      ...options,
      statusCode: 500,
    });
  }
}
