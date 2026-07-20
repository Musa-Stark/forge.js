import type { MongooseField } from "../lib/mongoose.fields.ts";
import type { OAuthProvider } from "../lib/OAuthProviders.ts";
import type { Role } from "../lib/roles.ts";
import type { ZodValidation } from "../lib/zod.fields.ts";
import type { RoutePath } from "./Routepath.ts";
import type { healthHandlers } from "./healthHandlers.ts";
import type { authHandlers } from "./authHandlers.ts";
import type { crudHandlers } from "./crudHandlers.ts";
import type { uploadHandlers } from "./uploadHandlers.js";
import type { Email } from "./email.ts";
import type { Upload } from "./upload.ts";

export type Handler = healthHandlers | authHandlers | crudHandlers | uploadHandlers;

// export type Middleware = "upload";
// export type MiddlewareInput = Middleware | Middleware[];

export type AuthRole = "admin" | "adminOrOwner" | "authenticated" | "public";
export type RouteMethod = "get" | "post" | "patch" | "delete";
export type AuthMode = "credentials" | "otp";
// | "magic-link" | "oauth";

export interface Route {
  method: RouteMethod;
  path: RoutePath;
  handler: Handler;
  validationKey: string | boolean;
  authRole: AuthRole;
  // middlewareArray?: MiddlewareInput;
  fileArray?: Upload[];
  // emailsArray?: Email | Email[];
  mode?: AuthMode;
}

export type MongooseSchema = {
  status: "pending" | "accepted" | "rejected";
  // provider: OAuthProvider;
  role: Role;
} & {
  [key: string]: MongooseField;
};

export type ValidationsObj = {} & {
  [key: string]: ZodValidation;
};

export type ReqType = "auth" | "health" | "crud";
// | "realtime"

export interface Collection {
  reqType: ReqType;
  routeName: string;
  routesArray: Route[];
  modelName?: string;
  mongooseSchemaObj?: MongooseSchema;
  validationsObj?: ValidationsObj;
}
