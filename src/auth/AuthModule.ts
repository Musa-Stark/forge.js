import { FeatureModule, type HandlerFn } from "../core/FeatureModule.js";
import type { Services } from "../core/Services.js";
import {
  magicLinkModel, mfaFactorModel, oauthIdentityModel, otpRequestModel, refreshTokenModel,
  MAGIC_LINK_MODEL, MFA_FACTOR_MODEL, OAUTH_IDENTITY_MODEL, OTP_REQUEST_MODEL, REFRESH_TOKEN_MODEL,
} from "../data/internalModels.js";
import { OAuthController } from "../oauth/OAuthController.js";
import { ConfigurationError } from "../errors/index.js";
import type { Collection } from "../types/Collection.js";
import type { AccessLevel, Route } from "../types/Route.js";
import { AuthController } from "./AuthController.js";
import { AuthServices } from "./AuthServices.js";
import { MagicLinkController } from "./MagicLinkController.js";
import { MfaController } from "./MfaController.js";

/** Handlers that are cheap, read-only or already protected, so they use the global rate limit only. */
const LIGHT_HANDLERS = new Set(["refresh", "logout", "oauthProviders", "authMethods", "mfaStatus"]);

/**
 * `type: "auth"` collections: every way of signing in (password, e-mailed code, magic link, social login),
 * the second factor, password reset, refresh and logout.
 */
export class AuthModule extends FeatureModule {
  readonly type = "auth";
  private userFields: ReadonlySet<string> = new Set();
  private readonly graph: AuthServices;
  private readonly controller: AuthController;
  private readonly oauthController: OAuthController;
  private readonly magicController: MagicLinkController;
  private readonly mfaController: MfaController;

  constructor(services: Services) {
    super(services);
    this.graph = new AuthServices(services, () => this.userFields);
    this.controller = new AuthController(services, () => this.graph.auth);
    this.oauthController = new OAuthController(services, () => this.graph.oauth);
    this.magicController = new MagicLinkController(services, () => this.graph.magicLink);
    this.mfaController = new MfaController(services, () => this.graph.requireMfa(), () => this.graph.completer);
  }

  protected handlers(): Readonly<Record<string, HandlerFn>> {
    const c = this.controller;
    const m = this.mfaController;
    return {
      authMethods: c.authMethods,
      signup: c.signup,
      login: c.login,
      verifyOTP: c.verifyOTP,
      resendOTP: c.resendOTP,
      forgotPassword: c.forgotPassword,
      resetPassword: c.resetPassword,
      refresh: c.refresh,
      logout: c.logout,
      oauthProviders: this.oauthController.oauthProviders,
      oauthStart: this.oauthController.oauthStart,
      oauthCallback: this.oauthController.oauthCallback,
      magicLinkRequest: this.magicController.magicLinkRequest,
      magicLinkVerify: this.magicController.magicLinkVerify,
      mfaStatus: m.mfaStatus,
      mfaSetup: m.mfaSetup,
      mfaEnable: m.mfaEnable,
      mfaVerify: m.mfaVerify,
      mfaDisable: m.mfaDisable,
      mfaRecoveryCodes: m.mfaRecoveryCodes,
    };
  }

  protected override defaultAuth(): AccessLevel {
    return "public";
  }

  /** Everything that can be brute-forced or costs money gets the strict limiter. */
  protected override isSensitive(route: Route): boolean {
    return !LIGHT_HANDLERS.has(route.handler);
  }

  override prepare(collection: Collection): void {
    if (!collection.model || !collection.schema) {
      throw new ConfigurationError({ message: `The '${collection.route}' auth collection needs 'model' and 'schema'.` });
    }
    const { data, sanitizer, compiler, config } = this.services;
    data.register({ name: collection.model, schema: collection.schema });
    sanitizer.addSecrets(compiler.secretFieldsOf(collection.schema));

    const internal = [
      [REFRESH_TOKEN_MODEL, () => refreshTokenModel(collection.model!)],
      [OTP_REQUEST_MODEL, () => otpRequestModel()],
      ...(this.services.oauth.size > 0 ? [[OAUTH_IDENTITY_MODEL, () => oauthIdentityModel(collection.model!)] as const] : []),
      ...(config.auth.magicLink ? [[MAGIC_LINK_MODEL, () => magicLinkModel()] as const] : []),
      ...(config.auth.mfa ? [[MFA_FACTOR_MODEL, () => mfaFactorModel(collection.model!)] as const] : []),
    ] as const;
    for (const [name, definition] of internal) if (!data.has(name)) data.register(definition());

    this.userFields = new Set(Object.keys(collection.schema));
  }
}
