import type { Request } from "express";
import type { Document, Model } from "mongoose";

/**
 * Context payload passed to custom action hooks before or after route execution.
 */
export interface ActionContext {
  /**
   * Express request object.
   */
  req: Request;

  /**
   * Currently authenticated user profile attached to the request.
   */
  user?: Request["user"];

  /**
   * The collection's Express route name.
   * 
   * @example "products"
   */
  route: string;

  /**
   * Database operation being executed by the handler.
   */
  operation:
    | "read"
    | "readAll"
    | "create"
    | "update"
    | "remove"
    | "removeMultiple"
    | "removeAll";

  /**
   * Mongoose model name.
   * 
   * @example "Product"
   */
  model: string;

  /**
   * Mongoose Model instance for performing direct database queries.
   */
  Model?: Model<any>;

  /**
   * Incoming request payload and processed metadata.
   */
  data?: {
    /**
     * ID or reference of the resource owner.
     */
    owner?: string;

    /**
     * Parsed request body object.
     */
    body?: any;

    /**
     * Metadata from uploaded files (if multipart route).
     */
    files?: any;

    /**
     * Encrypted field values.
     */
    encrypted?: any;

    /**
     * Decrypted field values.
     */
    decrypted?: any;

    /**
     * Hashed field values.
     */
    hashed?: any;
  };

  /**
   * The database document(s) fetched or updated during the operation.
   */
  item?: Document | Document[];

  /**
   * The final processed result payload ready to be returned in the response.
   */
  result?: any;
}

/**
 * A custom action hook executed before or after a route handler runs.
 * 
 * @example
 * ```ts
 * const sendWelcomeEmail: Action = {
 *   type: "email",
 *   handler: async ({ user, data }) => {
 *     console.log(`Sending email to ${user?.email}`);
 *   },
 * };
 * ```
 */
export interface Action {
  /**
   * Action category type.
   * 
   * - `custom`: General custom middleware logic.
   * - `email`: Dedicated email notification trigger.
   */
  type: "custom" | "email";

  /**
   * Async handler function executed by the framework.
   */
  handler: (context: ActionContext) => Promise<void> | void;
}

// Backward compatibility alias for legacy code
export type CreateContext = ActionContext;