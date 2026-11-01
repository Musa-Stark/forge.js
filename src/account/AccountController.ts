import type { Request, Response } from "express";
import { ErrorCode, NotFoundError, UnauthorizedError } from "../errors/index.js";
import type { RouteContext } from "../core/RouteContext.js";
import type { Services } from "../core/Services.js";
import { MAGIC_LINK_MODEL, MFA_FACTOR_MODEL, OAUTH_IDENTITY_MODEL } from "../data/internalModels.js";
import type { Doc } from "../data/Repository.js";

/** The signed-in user's own profile: read, update and delete. */
export class AccountController {
  constructor(private readonly services: Services) {}

  private get users() {
    return this.services.data.repository(this.model);
  }

  private get model(): string {
    if (!this.services.userModel) throw new Error("The account module needs a user model.");
    return this.services.userModel;
  }

  private async currentUser(req: Request, withPassword = false): Promise<Doc> {
    const user = await this.users.findById(req.user?._id ?? "", {
      withSecrets: withPassword ? [this.services.config.auth.fields.password] : undefined,
    });
    if (!user) throw new NotFoundError({ message: "Account not found.", code: ErrorCode.USER_NOT_FOUND });
    return user;
  }

  getMe = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    const user = await this.currentUser(req);
    this.services.responses.success(res, {
      message: "Profile fetched successfully.",
      data: await this.present(ctx, user),
    });
  };

  updateMe = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    await this.services.actions.runBefore(ctx.route.actions?.before, ctx.actionContext(req, "update"));

    const passwordField = this.services.config.auth.fields.password;
    const current = await this.currentUser(req, true);
    let body = this.services.access.writableBody(ctx.parseBody(req.body), req.user) as Record<string, unknown>;
    const changingPassword = typeof body[passwordField] === "string";

    if (changingPassword) {
      // A stolen session must not be enough to take over the account.
      const proof = (req.body as Record<string, unknown> | undefined)?.currentPassword;
      const stored = current[passwordField] as string | undefined;
      if (typeof proof !== "string" || !(await this.services.hasher.verify(proof, stored))) {
        throw new UnauthorizedError({
          message: "Your current password is required to set a new one.",
          code: ErrorCode.INVALID_CREDENTIALS,
        });
      }
      body = { ...body, [passwordField]: await this.services.hasher.hash(body[passwordField] as string) };
    }

    body = await this.services.transformer.encrypt(body, ctx.route.encryptedFields);
    body = await this.services.transformer.hash(body, ctx.route.hashedFields?.filter((f) => f.replace(/\?$/, "") !== passwordField));

    const updated = await this.users.updateById(current._id, body);
    if (!updated) throw new NotFoundError({ message: "Account not found.", code: ErrorCode.USER_NOT_FOUND });

    if (changingPassword) {
      await this.services.sessions.revokeAll(current._id);
      this.services.cookies.clear(res);
    }

    const item = await this.present(ctx, updated);
    const response = {
      success: true,
      message: changingPassword ? "Profile updated. Please log in again with your new password." : "Profile updated successfully.",
      data: item,
    };
    const replaced = await this.services.actions.runAfter(
      ctx.route.actions?.after,
      { ...ctx.actionContext(req, "update", { body }), item, result: response },
    );
    this.services.responses.success(res, { ...response, data: replaced ?? response.data });
  };

  deleteMe = async (req: Request, res: Response, ctx: RouteContext): Promise<void> => {
    await this.services.actions.runBefore(ctx.route.actions?.before, ctx.actionContext(req, "remove"));

    const user = await this.currentUser(req);
    await this.users.deleteById(user._id);
    await this.services.sessions.revokeAll(user._id);
    await this.purgeCredentials(user);
    this.services.cookies.clear(res);

    const item = await this.present(ctx, user);
    const response = { success: true, message: "Account deleted successfully.", data: item };
    const replaced = await this.services.actions.runAfter(
      ctx.route.actions?.after,
      { ...ctx.actionContext(req, "remove"), item, result: response },
    );
    this.services.responses.success(res, { ...response, data: replaced ?? response.data });
  };

  /** Removes everything that could still sign in as, or unlock, the deleted account. */
  private async purgeCredentials(user: Doc): Promise<void> {
    const { data } = this.services;
    if (data.has(MFA_FACTOR_MODEL)) await data.repository(MFA_FACTOR_MODEL).deleteMany({ owner: user._id });
    if (data.has(OAUTH_IDENTITY_MODEL)) await data.repository(OAUTH_IDENTITY_MODEL).deleteMany({ owner: user._id });
    const email = user[this.services.config.auth.fields.email];
    if (data.has(MAGIC_LINK_MODEL) && typeof email === "string") await data.repository(MAGIC_LINK_MODEL).deleteMany({ email });
  }

  private async present(ctx: RouteContext, doc: Doc): Promise<Record<string, unknown>> {
    const plain = await this.services.transformer.decrypt(doc, ctx.route.decryptedFields);
    return { ...this.services.sanitizer.one(doc, { hiddenFields: ctx.route.config?.hiddenFields }), ...plain };
  }
}
