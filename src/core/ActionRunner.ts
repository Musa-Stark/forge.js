import { ConfigurationError, ErrorCode } from "../errors/index.js";
import type { EmailService } from "../email/EmailService.js";
import type { Action, ActionContext } from "../types/ActionHandler.js";
import type { Logger } from "../utils/Logger.js";

export const isCustomAction = (
  a: Action,
): a is Extract<Action, { customAction: unknown }> =>
  typeof a === "object" &&
  a !== null &&
  "customAction" in a &&
  typeof (a as { customAction: unknown }).customAction === "function";

export const isEmailAction = (
  a: Action,
): a is Extract<Action, { emailAction: unknown }> =>
  typeof a === "object" &&
  a !== null &&
  "emailAction" in a &&
  typeof (a as { emailAction: unknown }).emailAction === "object";

/**
 * Runs the `actions.before` / `actions.after` hooks of a route.
 *
 * - `before` actions run in order and may abort the request by throwing.
 *   A `customAction` that returns a value replaces the action data.
 * - `after` actions run once the data is already saved, so a failing hook is
 *   logged instead of reporting a failure for work that actually succeeded.
 *   A `customAction` that returns a value replaces the response data.
 * - Every action is awaited.
 */
export class ActionRunner {
  constructor(
    private readonly emails: EmailService,
    private readonly logger: Logger,
  ) {}

  /** Fail fast at startup if a hook has an unknown shape. */
  assertValid(actions: readonly Action[] | undefined, where: string): void {
    for (const action of actions ?? []) {
      if (!isCustomAction(action) && !isEmailAction(action)) {
        throw new ConfigurationError({
          message: `${where}: an action must be { customAction: fn } or { emailAction: {...} }.`,
          code: ErrorCode.CONFIGURATION_ERROR,
        });
      }
    }
  }

  /** Returns the replacement data, if any before action produced one. */
  async runBefore(
    actions: readonly Action[] | undefined,
    context: ActionContext,
  ): Promise<unknown> {
    let merge: unknown;

    for (const action of actions ?? []) {
      const result = await this.execute(action, {
        ...context,
        result: merge !== undefined ? merge : context.result,
      });

      if (result !== undefined) {
        merge = result;
      }
    }

    return merge;
  }

  /** Returns the replacement response data, if any action produced one. */
  async runAfter(
    actions: readonly Action[] | undefined,
    context: ActionContext,
  ): Promise<unknown> {
    let replacement: unknown;

    for (const action of actions ?? []) {
      try {
        const result = await this.execute(action, {
          ...context,
          result: context.result,
        });

        if (result !== undefined) {
          if (this.isResponse(result) && context.result && typeof context.result === "object") {
            // Returning ctx.result (or a copy of it) replaces the response body,
            // instead of nesting the envelope inside response.data.
            const current = context.result as Record<string, unknown>;
            const next = { ...result };
            for (const key of Object.keys(current)) delete current[key];
            Object.assign(current, next);
            replacement = undefined;
          } else {
            replacement = result;
            // Keep the established shorthand: returning a value replaces data.
            if (context.result && typeof context.result === "object" && "data" in context.result) {
              (context.result as { data: unknown }).data = result;
            }
          }
        }
      } catch (error) {
        this.logger.error(
          `An 'after' action failed on ${context.model}/${context.operation}.`,
          {
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }

    return replacement;
  }

  private async execute(
    action: Action,
    context: ActionContext,
  ): Promise<unknown> {
    if (isCustomAction(action)) return action.customAction(context);

    await this.emails.sendAction(action.emailAction, context);
    return undefined;
  }

  private isResponse(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const response = value as Record<string, unknown>;
    return response.success === true && typeof response.message === "string" && "data" in response;
  }
}
