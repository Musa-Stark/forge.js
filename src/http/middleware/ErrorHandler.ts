import type { ErrorRequestHandler, RequestHandler } from "express";
import type { ForgeConfig } from "../../config/ForgeConfig.js";
import { AppError, ErrorCode, ErrorTranslator, NotFoundError, ValidationError } from "../../errors/index.js";
import type { Logger } from "../../utils/Logger.js";

/** Last two middlewares of the stack: 404 for unknown routes and the central error handler. */
export class ErrorHandler {
  constructor(
    private readonly config: ForgeConfig,
    private readonly logger: Logger,
    private readonly translator: ErrorTranslator = new ErrorTranslator(),
  ) {}

  notFound(): RequestHandler {
    return (req, _res, next) => {
      next(
        new NotFoundError({
          message: `Route not found: ${req.method} ${req.originalUrl.split("?")[0]}`,
          code: ErrorCode.ROUTE_NOT_FOUND,
          hint: `API routes live under ${this.config.apiPrefix}.`,
        }),
      );
    };
  }

  handler(): ErrorRequestHandler {
    return (error, req, res, next) => {
      if (res.headersSent) return next(error);

      const appError = this.translator.translate(error);
      this.log(appError, error, req.requestId, req.method, req.originalUrl);

      for (const [name, value] of Object.entries(appError.headers ?? {})) res.setHeader(name, value);

      // Never leak internals of unexpected failures.
      const safeMessage = appError.isOperational || this.config.exposeErrorDetails ? appError.message : "Something went wrong.";

      res.status(appError.statusCode).json({
        success: false,
        message: safeMessage,
        code: appError.code,
        ...(appError instanceof ValidationError && appError.issues.length > 0 ? { issues: appError.issues } : {}),
        ...(this.config.exposeErrorDetails && appError.hint ? { hint: appError.hint } : {}),
        ...(this.config.exposeErrorDetails && appError.details ? { details: appError.details } : {}),
        ...(req.requestId ? { requestId: req.requestId } : {}),
      });
    };
  }

  private log(appError: AppError, original: unknown, requestId: string | undefined, method: string, url: string): void {
    const meta = { requestId, code: appError.code, status: appError.statusCode };
    const line = `${method} ${url.split("?")[0]} → ${appError.statusCode} ${appError.code}`;
    if (appError.statusCode >= 500) {
      this.logger.error(`${line}: ${appError.message}`, {
        ...meta,
        stack: (appError.cause as Error | undefined)?.stack ?? (original as Error | undefined)?.stack,
      });
    } else {
      this.logger.debug(line, meta);
    }
  }
}
