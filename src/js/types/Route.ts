import type { RoutePath } from "./Routepath.js";
import type { authHandlers } from "./authHandlers.ts";
import type { crudHandlers } from "./crudHandlers.ts";
import type { uploadHandlers } from "./uploadHandlers.js";
import type { accountHandlers } from "./accountHandlers.js";
import type { Action } from "./ActionHandler.js";
import type { Upload } from "./upload.ts";

/**
 * Supported HTTP request methods for endpoints.
 */
export type RouteMethod = "get" | "post" | "patch" | "delete";

/**
 * Access levels required to call an endpoint.
 *
 * - `public`: Anyone can access (no login required).
 * - `authenticated`: Any logged-in user can access.
 * - `admin`: Only users with the admin role can access.
 * - `admin-or-owner`: Admins or the owner of the resource can access.
 */
export type AuthRole = "admin" | "admin-or-owner" | "authenticated" | "public";

/**
 * Authentication mode required for auth-related routes.
 */
export type AuthMode = "credentials" | "otp";

/**
 * Built-in framework handlers for processing requests.
 */
export type Handler =
  | authHandlers
  | crudHandlers
  | uploadHandlers
  | accountHandlers;

/**
 * Configuration options for database queries on this route.
 */
export interface RouteDbConfig {
  /**
   * Schema field name to automatically populate via Mongoose `.populate()`.
   * Set to `false` to disable automatic population.
   *
   * @example "owner"
   */
  populate?: string | boolean;

  /**
   * List of schema fields to hide from the JSON response.
   *
   * @example ["__v", "password", "updatedAt"]
   */
  hiddenFields?: string[];

  /**
   * Field name in request body that contains the list of IDs for batch operations.
   *
   * @example "ids"
   */
  targetField?: "ids" | (string & {});
}

/**
 * Defines a single API route/endpoint inside a collection.
 *
 * @example
 * ```ts
 * {
 *   method: "get",
 *   path: "/:id",
 *   handler: "read",
 *   auth: "admin-or-owner",
 *   validation: "readProduct",
 *   config: {
 *     populate: "owner",
 *     hiddenFields: ["__v"],
 *   },
 * }
 * ```
 */
export interface Route {
  /**
   * HTTP method for this endpoint.
   *
   * @example "get"
   */
  method: RouteMethod;

  /**
   * URL route path pattern.
   *
   * @example "/:id"
   */
  path: RoutePath;

  /**
   * Name of the framework controller handler to run.
   *
   * @example "readAll"
   */
  handler: Handler;

  /**
   * Validation key defined in your collection's `validations` object.
   * Set to `false` to disable input validation for this route.
   *
   * @example "createProduct"
   */
  validation?: string | boolean;

  /**
   * User role required to access this route.
   *
   * @example "authenticated"
   */
  auth?: AuthRole;

  /**
   * Resource ownership check setting.
   */
  ownership?: "self" | "owner";

  /**
   * Database options for this route (population, field masking, etc.).
   */
  config?: RouteDbConfig;

  /**
   * File upload settings for multipart requests.
   */
  files?: Upload[];

  /**
   * Authentication method used for login or verification routes.
   */
  mode?: AuthMode;

  /**
   * Fields to automatically encrypt before saving to the database.
   *
   * @example ["cardNumber", "ssn"]
   */
  encryptedFields?: string[];

  /**
   * Encrypted fields to automatically decrypt before returning the response.
   *
   * @example ["cardNumber"]
   */
  decryptedFields?: string[];

  /**
   * Fields to hash before storing (such as passwords).
   *
   * @example ["password"]
   */
  hashedFields?: string[];

  /**
   * Custom middleware hooks to run before or after the main handler.
   */
  actions?: {
    /**
     * Middleware functions to run BEFORE the handler.
     */
    before?: Action[];

    /**
     * Middleware functions to run AFTER the handler.
     */
    after?: Action[];
  };
}
