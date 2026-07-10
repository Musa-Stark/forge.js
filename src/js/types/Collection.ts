import type { MongooseField } from "../lib/mongoose.fields.ts";
import type { ZodValidation } from "../lib/zod.fields.ts";
import type { authHandlers } from "./authHandlers.ts";
import type { healthHandlers } from "./healthHandlers.ts";
import type { RoutePath } from "./Routepath.js";

export type Handler = healthHandlers | authHandlers;

export type Middleware = "upload" | "protect";
export type MiddlewareInput = Middleware | Middleware[];

export type AuthRole = "admin" | "owner" | "both" | "public";
export type AuthInput = false | AuthRole | AuthRole[];

export type Upload = false | "image" | "images" | "file" | "files";

export interface Email {
  to: string;
  subject: string;
  body: string;
}

export type RouteMethod = "get" | "post" | "put" | "patch" | "delete";
export type AuthMode = "credentials" | "otp";
// | "magic-link" | "oauth";

export interface Route {
  method: RouteMethod;
  path: RoutePath;
  handler: Handler;
  middlewares?: MiddlewareInput;
  authRole?: AuthInput;
  upload?: Upload;
  emails?: Email[];
  mode?: AuthMode;
}

export type MongooseSchema = {
  status: "pending" | "accepted" | "rejected";
} & {
  [key: string]: MongooseField;
};

export type ValidationsObj = {
  status: "pending" | "accepted" | "rejected";
} & {
  [key: string]: ZodValidation;
};

export type ReqType = "auth" | "health";
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
