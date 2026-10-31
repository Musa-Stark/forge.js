import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AppError, BadRequestError, ConfigurationError, ConflictError, ErrorCode, ErrorTranslator, ForbiddenError,
  InternalError, NotFoundError, PayloadTooLargeError, ServiceUnavailableError, TooManyRequestsError,
  UnauthorizedError, ValidationError,
} from "../src/errors/index.js";

describe("AppError hierarchy", () => {
  it.each([
    [new BadRequestError({ message: "x" }), 400, ErrorCode.BAD_REQUEST],
    [new ValidationError({ message: "x" }), 422, ErrorCode.VALIDATION_FAILED],
    [new UnauthorizedError({ message: "x" }), 401, ErrorCode.ACCESS_TOKEN_INVALID],
    [new ForbiddenError({ message: "x" }), 403, ErrorCode.FORBIDDEN],
    [new NotFoundError({ message: "x" }), 404, ErrorCode.RESOURCE_NOT_FOUND],
    [new ConflictError({ message: "x" }), 409, ErrorCode.CONFLICT],
    [new PayloadTooLargeError({ message: "x" }), 413, ErrorCode.PAYLOAD_TOO_LARGE],
    [new TooManyRequestsError({ message: "x" }), 429, ErrorCode.RATE_LIMITED],
    [new ConfigurationError({ message: "x" }), 500, ErrorCode.CONFIGURATION_ERROR],
    [new ServiceUnavailableError({ message: "x" }), 503, ErrorCode.SERVICE_UNAVAILABLE],
    [new InternalError({ message: "x" }), 500, ErrorCode.INTERNAL_ERROR],
  ])("%o carries the right status and code", (error, status, code) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(status);
    expect(error.code).toBe(code);
  });

  it("lets a subclass override the default code but never the status", () => {
    const error = new NotFoundError({ message: "x", code: ErrorCode.FILE_NOT_FOUND });
    expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(error.statusCode).toBe(404);
  });

  it("marks bugs and misconfiguration as non-operational", () => {
    expect(new InternalError({ message: "x" }).isOperational).toBe(false);
    expect(new ConfigurationError({ message: "x" }).isOperational).toBe(false);
    expect(new BadRequestError({ message: "x" }).isOperational).toBe(true);
  });

  it("uses the subclass name and keeps the cause", () => {
    const cause = new Error("root");
    const error = new ConflictError({ message: "x", cause });
    expect(error.name).toBe("ConflictError");
    expect(error.cause).toBe(cause);
  });
});

describe("ErrorTranslator", () => {
  const translator = new ErrorTranslator();

  it("returns AppErrors untouched", () => {
    const error = new ForbiddenError({ message: "no" });
    expect(translator.translate(error)).toBe(error);
  });

  it("maps Zod errors to 422 with per-field issues", () => {
    const result = z.object({ email: z.string().email(), age: z.number() }).safeParse({ email: "nope", age: "x" });
    const error = translator.translate(result.error);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.statusCode).toBe(422);
    expect((error as ValidationError).issues.map((i) => i.path).sort()).toEqual(["age", "email"]);
  });

  it("maps malformed JSON to 400 INVALID_JSON", () => {
    const error = translator.translate(Object.assign(new SyntaxError("bad"), { type: "entity.parse.failed" }));
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe(ErrorCode.INVALID_JSON);
  });

  it("maps oversized bodies to 413", () => {
    expect(translator.translate({ type: "entity.too.large" }).statusCode).toBe(413);
  });

  it.each([
    ["LIMIT_FILE_SIZE", 413, ErrorCode.UPLOAD_TOO_LARGE],
    ["LIMIT_FILE_COUNT", 400, ErrorCode.UPLOAD_TOO_MANY_FILES],
    ["LIMIT_UNEXPECTED_FILE", 400, ErrorCode.UPLOAD_FIELD_NOT_FOUND],
    ["LIMIT_PART_COUNT", 400, ErrorCode.UPLOAD_FAILED],
  ])("maps Multer %s", (multerCode, status, code) => {
    const error = translator.translate({ name: "MulterError", code: multerCode, field: "avatar" });
    expect(error.statusCode).toBe(status);
    expect(error.code).toBe(code);
  });

  it("maps JWT errors to 401 with distinct codes", () => {
    expect(translator.translate({ name: "TokenExpiredError" }).code).toBe(ErrorCode.ACCESS_TOKEN_EXPIRED);
    expect(translator.translate({ name: "JsonWebTokenError" }).code).toBe(ErrorCode.ACCESS_TOKEN_INVALID);
  });

  it("maps duplicate keys to 409 and names the field", () => {
    const error = translator.translate({ code: 11000, keyPattern: { email: 1 } });
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe(ErrorCode.DUPLICATE_KEY);
    expect(error.message).toContain("email");
  });

  it("maps a duplicate key from insertMany to 409, even though the bulk write error has no keyPattern", () => {
    // The MongoDB driver throws a MongoBulkWriteError for `insertMany`: it keeps the code and the server message only.
    const bulk = Object.assign(
      new Error('E11000 duplicate key error collection: app.products index: sku_1 dup key: { sku: "KB-001" }'),
      { name: "MongoBulkWriteError", code: 11000, writeErrors: [] },
    );
    const error = translator.translate(bulk);
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe(ErrorCode.DUPLICATE_KEY);
    expect(error.message).toBe("An item with this sku already exists.");

    const compound = Object.assign(new Error("E11000 duplicate key error collection: app.products index: shop_1_sku_1 dup key: { shop: 1, sku: 2 }"), { code: 11000 });
    const generic = translator.translate(compound);
    expect(generic.statusCode).toBe(409);
    expect(generic.message).toBe("An item with this value already exists.");
  });

  it("maps CastError to 400 (not 409 like 1.x)", () => {
    const error = translator.translate({ name: "CastError", path: "_id" });
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe(ErrorCode.INVALID_OBJECT_ID);
  });

  it("maps Mongoose validation errors to 422", () => {
    const error = translator.translate({
      name: "ValidationError",
      errors: { name: { message: "Path `name` is required.", kind: "required", path: "name" } },
    });
    expect(error.statusCode).toBe(422);
    expect((error as ValidationError).issues[0]).toMatchObject({ path: "name", code: "required" });
  });

  it("maps connectivity failures to 503", () => {
    const error = translator.translate({ name: "MongoServerSelectionError" });
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe(ErrorCode.DATABASE_UNAVAILABLE);
  });

  it("hides the details of unknown failures behind a generic 500", () => {
    const error = translator.translate(new Error("connection string mongodb://user:pass@host"));
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(false);
    expect(error.message).not.toContain("pass");
  });

  it("copes with non-object throwables", () => {
    expect(translator.translate("boom").statusCode).toBe(500);
    expect(translator.translate(undefined).statusCode).toBe(500);
  });
});
