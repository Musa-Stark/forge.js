import type { MongooseField } from "../lib/mongoose.fields.ts";
import type { ZodValidation } from "../lib/zod.fields.ts";
import type { authHandlers } from "./authHandlers.ts";
import type { healthHandlers } from "./healthHandlers.ts";

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

export type ReqType = "auth" | "health";
// | "admin"
// | "realtime"
// | "upload";

export interface Collection {
  routeName: string;
  modelName?: string;
  routesArray: Route[];
  reqType: ReqType;
  mongooseSchemaObj?: {
    status: "pending" | "accepted" | "rejected";
  } & {
    [key: string]: MongooseField;
  };

  mongooseOTPSchemaObj?: {
    maxOtpTries: 5 | 7 | 10 | 15 | 20;
    otpExpiry: "3m" | "5m" | "10m" | "15m" | "20m";
  } & {
    [key: string]: MongooseField;
  };

  validationsObj?: {
    status: "pending" | "accepted" | "rejected";
  } & {
      [key: string]: ZodValidation;
    };
}
