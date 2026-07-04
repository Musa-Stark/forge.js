import type { MongooseField } from "../lib/mongoose.fields.ts";
import type { ZodValidation } from "../lib/zod.fields.ts";

type healthHandlers =
  | "healthGet"
  | "healthPost"
  | "healthPut"
  | "healthPatch"
  | "healthDelete";

export type Handler = healthHandlers;

export type Middleware = "upload" | "protect";
export type MiddlewareInput = Middleware | Middleware[];

export type AuthRole = "admin" | "owner" | "both";
export type AuthInput = false | AuthRole | AuthRole[];

export type Upload = false | "image" | "images" | "file" | "files";

export interface Email {
  to: string;
  subject: string;
  body: string;
}

export type RouteMethod = "get" | "post" | "put" | "patch" | "delete";
export type RoutePath = "/" | "/:id";
export type AuthMode = "credentials" | "otp";

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

export type ReqType =
  // | "admin"
  "auth" | "crud" | "health";
// | "realtime"
// | "upload";

export interface Collection {
  routeName: string;
  modelName: string;
  routes: Route[];
  reqType: ReqType;
  mongooseSchema: {
    [key: string]: MongooseField;
  };
  mongooseOTPSchema: {
    [key: string]: MongooseField;
  };
  validations: {
    [key: string]: ZodValidation;
  };
}
