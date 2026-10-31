import type { Action } from "./ActionHandler.js";
import type { Handler } from "./handlers.js";
import type { RoutePath } from "./Routepath.js";
import type { Upload } from "./upload.js";

export type { Handler } from "./handlers.js";

/** Supported HTTP request methods for endpoints. */
export type RouteMethod = "get" | "post" | "put" | "patch" | "delete";

/**
 * Who may call an endpoint. (This is an *access level*, not a user role: roles are things like
 * `"editor"` or `"admin"`, and are matched by `Route.roles`.)
 *
 * - `public`: anyone.
 * - `authenticated`: any logged-in user.
 * - `admin`: only users whose role is one of `adminRoles`.
 * - `admin-or-owner`: admins, or the owner of the targeted resource.
 */
export type AccessLevel = "admin" | "admin-or-owner" | "authenticated" | "public";

/** @deprecated Renamed to {@link AccessLevel}: it describes who may call a route, not a user's role. */
export type AuthRole = AccessLevel;

/** Authentication mode used by `login` / `signup`. */
export type AuthMode = "credentials" | "otp";

/** Database options for a route. */
export interface RouteDbConfig {
  /**
   * Schema field to populate: it must be declared with a `ref` to a model of the app. Separate several fields with a
   * space. Only `read` and `readAll` return populated documents. Set to `false` to disable.
   * @example "owner"
   * @example "owner product"
   */
  populate?: string | false;

  /**
   * Which fields of the populated documents to return (the same list for every populated field). It lists what to
   * include: a name that starts with `-` or `+` is refused at startup.
   * Defaults to `"_id"` so e-mail addresses and other personal data of
   * referenced documents are never exposed by accident.
   * @example "_id name"
   */
  populateSelect?: string;

  /**
   * Fields removed from the JSON response. Include `"_id"` to drop the id.
   * Prefix with `!` to opt back in to a field hidden by default
   * (credentials, tokens and other secrets can never be un-hidden).
   */
  hiddenFields?: string[];

  /** Body key holding the list of ids for batch operations. */
  targetField?: string;

  /** Maximum number of items accepted by `createBulk`. */
  maxBulkSize?: number;
}

/**
 * Defines a single endpoint inside a collection.
 *
 * @example
 * ```ts
 * { method: "get", path: "/:id", handler: "read", auth: "admin-or-owner",
 *   validation: false, config: { populate: "owner", hiddenFields: ["__v"] } }
 * ```
 */
export interface Route {
  method: RouteMethod;
  path: RoutePath | (string & {});
  handler: Handler;

  /**
   * Validation key defined in the collection's `validations`, or `false` when
   * the handler needs no request body.
   */
  validation?: string | boolean;

  /** Who may call this route. Defaults to `"authenticated"` for non-auth modules. */
  auth?: AccessLevel;

  /**
   * Restrict the route to users whose role is one of these (checked after `auth`, so both must pass).
   * Matching is exact and case-sensitive, and admins are **not** implicitly included: list `"admin"`
   * yourself if admins may call it. Needs a signed-in user, so it cannot be used with `auth: "public"`
   * or `"admin"` (use `adminRoles` for that).
   *
   * @example roles: ["editor", "moderator", "admin"]
   */
  roles?: string[];

  /** `"self"` means the document itself is the owner (e.g. a User). */
  ownership?: "self" | "owner";

  config?: RouteDbConfig;

  /** Multipart upload settings. */
  files?: Upload[];

  /** Authentication mode for login/signup routes. */
  mode?: AuthMode;

  /** Body fields sealed with the master key before saving. Suffix `?` = optional. */
  encryptedFields?: string[];

  /** Encrypted fields returned in plain text. Suffix `?` = optional. */
  decryptedFields?: string[];

  /** Body fields hashed (Argon2id) before saving. Suffix `?` = optional. */
  hashedFields?: string[];

  /** Hooks around the handler. */
  actions?: {
    /** Run before the operation. Throw to abort. */
    before?: Action[];
    /** Run after the operation. A `customAction` return value replaces the response data. */
    after?: Action[];
  };
}
