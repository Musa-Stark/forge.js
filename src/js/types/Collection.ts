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

export type Auth = "admin" | "owner";
export type AuthInput = false | Auth | Auth[];

export type Upload = false | "image" | "images" | "file" | "files";

export interface Email {
  to: string;
  subject: string;
  body: string;
}

export type RouteMethod = "get" | "post" | "put" | "patch" | "delete";
export type RoutePath = "/" | "/:id";

export interface Route {
  method: RouteMethod;
  path: RoutePath;
  handler: Handler;
  middlewares?: MiddlewareInput;
  auth?: AuthInput;
  upload?: Upload;
  emails?: Email[];
}

export type ReqType =
  // | "admin"
  // | "auth"
  "crud" | "health";
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
