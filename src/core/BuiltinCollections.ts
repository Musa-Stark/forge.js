import { z, type ZodType } from "zod";
import type { ForgeConfig } from "../config/ForgeConfig.js";
import type { SchemaCompiler } from "../data/SchemaCompiler.js";
import { OTP_PURPOSES } from "../auth/OtpService.js";
import type { Collection, CollectionValidations } from "../types/Collection.js";
import type { Route } from "../types/Route.js";

const post = (path: string, handler: Route["handler"], validation: string, extra: Partial<Route> = {}): Route => ({
  method: "post",
  path,
  handler,
  validation,
  auth: "public",
  ...extra,
});

/**
 * Generates the collections behind `builtinConfig` (auth, account, admin) and
 * the default health endpoint, so they run through the exact same pipeline as
 * collections you write yourself.
 */
export class BuiltinCollections {
  constructor(
    private readonly config: ForgeConfig,
    private readonly compiler: SchemaCompiler,
  ) {}

  build(): Collection[] {
    const collections: Collection[] = [];
    if (this.config.auth.mode === "builtin") collections.push(this.auth());
    if (this.config.account.mode === "builtin") collections.push(this.account());
    if (this.config.admin.mode === "builtin") collections.push(this.admin());
    if (!this.config.collections.some((c) => c.type === "health")) collections.push(this.health());
    return collections;
  }

  private auth(): Collection {
    const { mongooseConfig, fields } = this.config.auth;
    const schema = mongooseConfig!.schema;
    const emailRule = this.ruleOf(schema, fields.email) ?? z.string().trim().toLowerCase().email();
    const passwordRule = this.ruleOf(schema, fields.password) ?? z.string().min(8).max(128);
    const purpose = z.enum(OTP_PURPOSES as [string, ...string[]]);

    const signup: Record<string, ZodType> = {};
    for (const key of Object.keys(schema)) {
      const rule = this.ruleOf(schema, key);
      if (rule && !this.config.protectedFields.includes(key)) signup[key] = rule;
    }
    signup[fields.email] = emailRule;
    signup[fields.password] = passwordRule;

    const validations: CollectionValidations = {
      signup,
      // Existing users may have older, shorter passwords: login only checks "not empty and not absurdly long".
      login: { [fields.email]: emailRule, [fields.password]: z.string().min(1).max(128) },
      verifyOTP: { [fields.email]: emailRule, [fields.otp]: z.string().regex(/^\d{6}$/, "The code has 6 digits"), [fields.purpose]: purpose },
      resendOTP: { [fields.email]: emailRule, [fields.purpose]: purpose },
      forgotPassword: { [fields.email]: emailRule },
      resetPassword: {
        [fields.email]: emailRule,
        resetToken: z.string().min(20).max(200),
        [fields.password]: passwordRule,
      },
      magicLinkRequest: { [fields.email]: emailRule, name: z.string().trim().max(100).optional() },
      magicLinkVerify: { token: z.string().min(20).max(200) },
      mfaEnable: { code: z.string().min(6).max(12) },
      // Exactly one of the two is required; the controller enforces it.
      mfaSecondFactor: { code: z.string().max(12).optional(), recoveryCode: z.string().max(32).optional() },
      mfaVerify: { mfaToken: z.string().min(20).max(2000), code: z.string().max(12).optional(), recoveryCode: z.string().max(32).optional() },
    };

    return {
      type: "auth",
      route: "auth",
      model: mongooseConfig!.model,
      schema,
      validations,
      routes: [
        { method: "get", path: "/methods", handler: "authMethods", auth: "public", validation: false },
        post("/signup", "signup", "signup"),
        post("/verify-otp", "verifyOTP", "verifyOTP"),
        post("/login", "login", "login"),
        post("/resend-otp", "resendOTP", "resendOTP"),
        post("/forgot-password", "forgotPassword", "forgotPassword"),
        post("/reset-password", "resetPassword", "resetPassword"),
        { method: "post", path: "/logout", handler: "logout", auth: "public" },
        { method: "post", path: "/refresh-token", handler: "refresh", auth: "public" },
        ...this.oauthRoutes(),
        ...this.magicLinkRoutes(),
        ...this.mfaRoutes(),
      ],
    };
  }

  private magicLinkRoutes(): Route[] {
    if (!this.config.auth.magicLink) return [];
    return [post("/magic-link", "magicLinkRequest", "magicLinkRequest"), post("/magic-link/verify", "magicLinkVerify", "magicLinkVerify")];
  }

  private mfaRoutes(): Route[] {
    if (!this.config.auth.mfa) return [];
    const authed = (method: Route["method"], path: Route["path"], handler: Route["handler"], validation: Route["validation"] = false): Route => ({
      method, path, handler, validation, auth: "authenticated",
    });
    return [
      authed("get", "/mfa", "mfaStatus"),
      authed("post", "/mfa/totp/setup", "mfaSetup"),
      authed("post", "/mfa/totp/enable", "mfaEnable", "mfaEnable"),
      post("/mfa/verify", "mfaVerify", "mfaVerify"),
      authed("post", "/mfa/disable", "mfaDisable", "mfaSecondFactor"),
      authed("post", "/mfa/recovery-codes", "mfaRecoveryCodes", "mfaSecondFactor"),
    ];
  }

  /** "Sign in with ..." routes, present only when `auth.oauth` is configured. `/providers` must precede `/:provider`. */
  private oauthRoutes(): Route[] {
    if (!this.config.auth.oauth) return [];
    const get = (path: Route["path"], handler: Route["handler"]): Route => ({ method: "get", path, handler, auth: "public", validation: false });
    return [get("/oauth/providers", "oauthProviders"), get("/oauth/:provider", "oauthStart"), get("/oauth/:provider/callback", "oauthCallback")];
  }

  private account(): Collection {
    const { mongooseConfig } = this.config.auth;
    const schema = mongooseConfig!.schema;

    const updateProfile: Record<string, ZodType> = {};
    for (const key of Object.keys(schema)) {
      const rule = this.ruleOf(schema, key);
      if (rule && !this.config.protectedFields.includes(key)) updateProfile[key] = rule.optional();
    }

    return {
      type: "account",
      route: "account",
      model: mongooseConfig!.model,
      schema,
      validations: { updateProfile },
      routes: [
        { auth: "authenticated", handler: "getMe", method: "get", path: "/me" },
        // Any signed-in user, any role: `{ role, isAdmin }`.
        { auth: "authenticated", handler: "checkRole", method: "get", path: "/role" },
        { auth: "authenticated", handler: "updateMe", method: "patch", path: "/me", validation: "updateProfile" },
        { auth: "authenticated", handler: "deleteMe", method: "delete", path: "/me" },
      ],
    };
  }

  private admin(): Collection {
    return {
      type: "admin",
      route: "admin",
      routes: [{ auth: "admin", handler: "checkRole", method: "get", path: "/check" }],
    };
  }

  private health(): Collection {
    const method = (m: Route["method"], handler: Route["handler"]): Route => ({ method: m, handler, path: "/", auth: "public", validation: false });
    return {
      type: "health",
      route: "health",
      routes: [
        method("get", "healthGet"),
        method("post", "healthPost"),
        method("put", "healthPut"),
        method("patch", "healthPatch"),
        method("delete", "healthDelete"),
      ],
    };
  }

  private ruleOf(schema: Record<string, unknown>, key: string): ZodType | undefined {
    const field = schema[key];
    return field ? this.compiler.zodOf(field as never) : undefined;
  }
}
