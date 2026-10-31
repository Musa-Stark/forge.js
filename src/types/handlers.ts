/** Handler names grouped by the feature module that provides them. */
export const AUTH_HANDLERS = [
  "signup",
  "verifyOTP",
  "login",
  "resendOTP",
  "forgotPassword",
  "resetPassword",
  "logout",
  "refresh",
  "authMethods",
  "magicLinkRequest",
  "magicLinkVerify",
  "mfaStatus",
  "mfaSetup",
  "mfaEnable",
  "mfaVerify",
  "mfaDisable",
  "mfaRecoveryCodes",
  "oauthProviders",
  "oauthStart",
  "oauthCallback",
] as const;

export const CRUD_HANDLERS = [
  "read",
  "readAll",
  "create",
  "createBulk",
  "update",
  "remove",
  "removeMultiple",
  "removeAll",
] as const;

export const UPLOAD_HANDLERS = ["updateFile", "deleteFile", "addFile"] as const;

export const ACCOUNT_HANDLERS = ["getMe", "updateMe", "deleteMe", "checkRole"] as const;

/** `checkAdmin` is the 1.x name of `checkRole` and is deprecated. */
export const ADMIN_HANDLERS = ["checkRole", "checkAdmin"] as const;

export const HEALTH_HANDLERS = [
  "healthGet",
  "healthPost",
  "healthPut",
  "healthPatch",
  "healthDelete",
] as const;

export type AuthHandler = (typeof AUTH_HANDLERS)[number];
export type CrudHandler = (typeof CRUD_HANDLERS)[number];
export type UploadHandler = (typeof UPLOAD_HANDLERS)[number];
export type AccountHandler = (typeof ACCOUNT_HANDLERS)[number];
export type AdminHandler = (typeof ADMIN_HANDLERS)[number];
export type HealthHandler = (typeof HEALTH_HANDLERS)[number];

/** Built-in framework handlers a route can point at. */
export type Handler =
  | AuthHandler
  | CrudHandler
  | UploadHandler
  | AccountHandler
  | AdminHandler
  | HealthHandler;

// Kept for backward compatibility with the 1.x type names.
export type authHandlers = AuthHandler;
export type crudHandlers = CrudHandler;
export type uploadHandlers = UploadHandler;
export type accountHandlers = AccountHandler;
export type adminHandlers = AdminHandler;
