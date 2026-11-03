import type { Request, Response } from "express";
import type { Model } from "mongoose";
import type { Repository } from "../data/Repository.js";
import type { EmailActionTemplate } from "./EmailActionTemplate.js";

/** Operations that can trigger actions. */
export type ActionOperation =
  | "read"
  | "readAll"
  | "create"
  | "createBulk"
  | "update"
  | "remove"
  | "removeMultiple"
  | "removeAll"
  | "addFile"
  | "updateFile"
  | "deleteFile";

/** Context provided to Forge actions before or after a route operation. */
export interface ActionContext {
  /** Express request. */
  req: Request;

  /** Express response. Use in an `after` action for cookies or headers. */
  res: Response;

  /** Authenticated user, if any. */
  user?: Request["user"];

  /** Collection route segment, e.g. `"products"`. */
  route: string;

  /** Operation being performed. */
  operation: ActionOperation;

  /** Model name, e.g. `"Product"`. */
  model: string;

  /** Mongoose model (available when the default MongoDB data source is used). */
  Model?: Model<any> | undefined;

  /** Framework-agnostic data access for the model. */
  repository?: Repository | undefined;

  /**
   * Data access for any model of the app, by the model name of its collection, for example
   * `ctx.repositoryOf("Product")`. It works with the in-memory data source of `createTestForge` too, and throws a
   * `ConfigurationError` when no collection declares that model. The documents are raw: sanitise them before they
   * reach a response.
   */
  repositoryOf: (model: string) => Repository;

  /** Data associated with the current request. */
  data?: {
    owner?: string | undefined;
    body?: Record<string, unknown> | undefined;
    files?: unknown;
    encrypted?: Record<string, unknown> | undefined;
    hashed?: Record<string, unknown> | undefined;
  };

  /** Document(s) affected by the operation (already sanitised). */
  item?: unknown;

  /**
   * The mutable response body for `after` actions (message, data, and optional
   * metadata). A returned value from `customAction` replaces `result.data`.
   */
  result?: unknown;
}

/** Executes custom developer-defined logic. */
export interface CustomAction {
  customAction: (context: ActionContext) => Promise<unknown> | unknown;
}

/** Sends an e-mail through Forge's configured provider. */
export interface EmailAction {
  emailAction: {
    /** Sender, or `"system-email-sender"` to use `systemEmailSender`. */
    from: "system-email-sender" | (string & {});
    to: string | ((context: ActionContext) => string | Promise<string>);
    type: "template" | "raw";
    /** Raw HTML body when `type` is `"raw"`. It is sent as-is: never put user input in it. */
    rawBody?: string;
    template?: EmailActionTemplate;
    subject: string | ((context: ActionContext) => string);
  };
}

export type Action = CustomAction | EmailAction;

/** @deprecated Use {@link ActionContext}. */
export type CreateContext = ActionContext;
