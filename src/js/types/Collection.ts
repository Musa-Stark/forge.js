import type { MongooseField } from "../lib/mongoose.fields.ts";
import type { OAuthProvider } from "../lib/OAuthProviders.js";
import type { Role } from "../lib/roles.js";
import type { ZodValidation } from "../lib/zod.fields.ts";
import type { RoutePath } from "./Routepath.js";
import type { healthHandlers } from "./healthHandlers.ts";
import type { authHandlers } from "./authHandlers.ts";
import type { crudHandlers } from "./crudHandlers.js";

export type Handler = healthHandlers | authHandlers | crudHandlers;

export type Middleware = "upload";
export type MiddlewareInput = Middleware | Middleware[];

export type AuthRole = "admin" | "adminOrOwner" | "authenticated" | "public";
export type AuthInput = AuthRole;

export type Upload = "image" | "images" | "file" | "files";

export interface Email {
  to: string;
  subject: string;
  body: string;
}

export type RouteMethod = "get" | "post" | "patch" | "delete";
export type AuthMode = "credentials" | "otp";
// | "magic-link" | "oauth";

export interface Route {
  method: RouteMethod;
  path: RoutePath;
  handler: Handler;
  middlewareArray?: MiddlewareInput;
  authRole: AuthInput;
  upload?: Upload;
  emails?: Email[];
  mode?: AuthMode;
}

export type MongooseSchema = {
  status: "pending" | "accepted" | "rejected";
  provider: OAuthProvider;
  role: Role;
} & {
  [key: string]: MongooseField;
};

export type ValidationsObj = {} & {
  [key: string]: ZodValidation;
};

export type ReqType = "auth" | "health" | "crud";
// | "admin"
// | "realtime"
// | "upload";

export interface Collection {
  routeName: string;
  modelName?: string;
  routesArray: Route[];
  reqType: ReqType;
  mongooseSchemaObj?: MongooseSchema;

  validationsObj?: ValidationsObj;
}
