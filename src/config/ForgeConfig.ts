import { ConfigurationError } from "../errors/index.js";
import type { Collection } from "../types/Collection.js";
import type { CommonEmailPlaceholders } from "../types/email/static-config.type.js";
import { OAuthProviderFactory, type OAuthProviderEntry } from "../oauth/OAuthProviderFactory.js";
import type { OAuthProfile } from "../oauth/OAuthProvider.js";
import { Duration } from "./Duration.js";
import type {
  AccountConfig,
  AccountLinking,
  MagicLinkOptions,
  MfaOptions,
  AdminConfig,
  AuthConfig,
  AuthFieldNames,
  CookieOptions,
  CorsConfig,
  ForgeOptions,
  OtpOptions,
} from "./ForgeOptions.js";

const SENDER_PATTERN = /^\s*[^<>]+?\s*<\s*[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+\s*>\s*$/;
const MIN_SECRET_LENGTH = 32;
/** A cookie `Domain`: a host name, optionally with a leading dot. No scheme, port or path. */
const COOKIE_DOMAIN = /^\.?[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*$/;

export interface ResolvedOAuthConfig {
  providers: readonly OAuthProviderEntry[];
  successRedirect: string | undefined;
  failureRedirect: string | undefined;
  accountLinking: AccountLinking;
  stateAge: Duration;
  userFromProfile: ((profile: OAuthProfile) => Record<string, unknown>) | undefined;
}

export interface ResolvedMagicLinkConfig {
  url: string;
  expiresIn: Duration;
  resendCooldown: Duration;
  allowSignup: boolean;
  sameDevice: boolean;
  accountLinking: AccountLinking;
}

export interface ResolvedMfaConfig {
  issuer: string;
  challengeAge: Duration;
  maxAttempts: number;
  lockoutDuration: Duration;
  recoveryCodes: number;
  window: number;
}

/** Auth configuration after defaults were applied and durations parsed. */
export interface ResolvedAuthConfig {
  mode: "builtin" | "manual";
  ownerField: string;
  returnAccessToken: boolean;
  returnRefreshToken: boolean;
  rotateRefreshToken: boolean;
  refreshTokenRotationInterval: Duration;
  refreshReuseGracePeriod: Duration;
  verifyAccessUser: boolean;
  fields: AuthFieldNames;
  mongooseConfig: AuthConfig["mongooseConfig"];
  accessTokenName: string;
  refreshTokenName: string;
  accessTokenAge: Duration;
  refreshTokenAge: Duration;
  signupMode: "credentials" | "otp";
  loginMode: "credentials" | "otp";
  otp: {
    expiresIn: Duration;
    maxAttempts: number;
    resendCooldown: Duration;
    maxResends: number;
    verifiedWindow: Duration;
  };
  cookie: Required<Pick<CookieOptions, "sameSite" | "secure" | "path">> & { domain?: string };
  oauth: ResolvedOAuthConfig | undefined;
  magicLink: ResolvedMagicLinkConfig | undefined;
  mfa: ResolvedMfaConfig | undefined;
}

/**
 * Validated, immutable framework configuration.
 *
 * 1.x kept configuration in module-level globals and called `process.exit(1)`
 * on bad input. Here the configuration is a value that is passed around, and
 * every problem is reported at once through a {@link ConfigurationError}.
 */
export class ForgeConfig {
  readonly env: string;
  readonly isProduction: boolean;
  readonly isTest: boolean;
  readonly port: number;
  readonly apiVersion: number;
  readonly apiPrefix: string;
  readonly backendURL: string;
  readonly frontendOrigins: readonly string[];
  readonly corsConfig: CorsConfig | undefined;
  readonly trustProxy: boolean | number | string;
  readonly logRequests: boolean;
  readonly exposeErrorDetails: boolean;
  readonly bodyLimit: string;

  readonly isOffline: boolean;
  readonly mongoDBURI: string | undefined;
  readonly databaseName: string;

  readonly jwtSecret: string | undefined;
  readonly masterKey: string | undefined;
  readonly adminRoles: readonly string[];
  readonly protectedFields: readonly string[];

  readonly rateLimit: { window: Duration; max: number; message: string; authMax: number; store: ForgeOptionsStore };

  readonly systemEmailSender: string | undefined;
  readonly resendAPIKey: string | undefined;

  readonly cloudinary: { apiKey?: string; apiSecret?: string; cloudName?: string; folder: string };
  readonly upload: { maxFileSize: number; maxFiles: number };
  readonly pagination: { defaultSize: number; maxSize: number };

  readonly auth: ResolvedAuthConfig;
  readonly admin: AdminConfig;
  readonly account: AccountConfig;
  readonly email: CommonEmailPlaceholders | undefined;
  readonly collections: readonly Collection[];

  /** Non-fatal problems found while validating (printed at start-up). */
  readonly warnings: readonly string[];

  constructor(options: ForgeOptions = {}) {
    const problems: string[] = [];
    const warnings: string[] = [];

    this.env = options.ENV ?? "development";
    this.isProduction = this.env === "production";
    this.isTest = this.env === "test";

    this.port = options.port ?? 5000;
    if (!Number.isInteger(this.port) || this.port < 0 || this.port > 65535) {
      problems.push(`port must be an integer between 0 and 65535 (received ${String(options.port)}).`);
    }

    this.apiVersion = options.apiVersion ?? 1;
    if (!Number.isInteger(this.apiVersion) || this.apiVersion < 1) {
      problems.push("apiVersion must be a positive integer.");
    }
    this.apiPrefix = `/api/v${this.apiVersion}`;
    this.backendURL = options.backendURL ?? `http://localhost:${this.port}${this.apiPrefix}`;

    this.frontendOrigins = [
      ...(options.frontendURL ? [options.frontendURL] : []),
      ...(options.frontendURLs ?? []),
    ];
    this.corsConfig = options.corsConfig;
    this.trustProxy = options.trustProxy ?? false;
    this.logRequests = options.logRequests ?? !this.isTest;
    this.exposeErrorDetails = options.exposeErrorDetails ?? !this.isProduction;
    this.bodyLimit = options.bodyLimit ?? "100kb";

    // Database
    this.isOffline = options.isOffline ?? !this.isProduction;
    this.mongoDBURI = options.mongoDBURI;
    this.databaseName = options.databaseName ?? "starkForge";
    if (this.isProduction && this.isOffline) {
      problems.push("isOffline cannot be true in production: it prints one-time codes to the console and targets a local database.");
    }
    if (!this.isOffline && !this.mongoDBURI) {
      problems.push("mongoDBURI is required when isOffline is false.");
    }

    // Security
    this.jwtSecret = options.jwtSecret;
    this.masterKey = options.masterKey;
    this.adminRoles = Object.freeze([...(options.adminRoles ?? ["admin"])]);
    this.protectedFields = Object.freeze([...(options.protectedFields ?? ["role"])]);
    if (this.adminRoles.length === 0) problems.push("adminRoles must contain at least one role.");
    if (this.masterKey !== undefined && Buffer.from(this.masterKey, "base64").length !== 32) {
      problems.push("masterKey must be a base64 encoded 32-byte key. Generate one with generateMasterKey().");
    }

    // Rate limiting
    const max = options.maxReqLimit ?? 100;
    if (!Number.isFinite(max) || max <= 0) problems.push("maxReqLimit must be a positive number.");
    const authMax = options.authMaxReqLimit ?? 20;
    if (!Number.isFinite(authMax) || authMax <= 0) problems.push("authMaxReqLimit must be a positive number.");
    this.rateLimit = {
      window: this.parseDuration(options.rateLimitDuration ?? "15m", "rateLimitDuration", problems),
      max: Math.min(max, Number.MAX_SAFE_INTEGER),
      message: options.rateLimitMsg ?? "Too many requests, please try again later.",
      authMax: Math.min(authMax, Number.MAX_SAFE_INTEGER),
      store: options.rateLimitStore,
    };

    // E-mail
    this.systemEmailSender = options.systemEmailSender;
    this.resendAPIKey = options.resendAPIKey;
    if (this.systemEmailSender && !SENDER_PATTERN.test(this.systemEmailSender)) {
      problems.push("systemEmailSender must look like 'Starklabs <noreply@starklabs.com>'.");
    }

    // Uploads / pagination
    this.cloudinary = {
      ...(options.cloudinaryAPIKey ? { apiKey: options.cloudinaryAPIKey } : {}),
      ...(options.cloudinaryAPISecret ? { apiSecret: options.cloudinaryAPISecret } : {}),
      ...(options.cloudinaryCloudName ? { cloudName: options.cloudinaryCloudName } : {}),
      folder: options.cloudinaryFolderName ?? "starkForge",
    };
    this.upload = {
      maxFileSize: options.uploadMaxFileSize ?? 5 * 1024 * 1024,
      maxFiles: options.uploadMaxFiles ?? 10,
    };
    this.pagination = {
      defaultSize: options.defaultPageSize ?? 50,
      maxSize: options.maxPageSize ?? 100,
    };
    if (this.pagination.defaultSize > this.pagination.maxSize) {
      problems.push("defaultPageSize cannot be larger than maxPageSize.");
    }

    // Built-in features
    const builtin = options.builtinConfig ?? {};
    this.admin = builtin.admin ?? { mode: "manual" };
    this.account = builtin.account ?? { mode: "manual" };
    this.email = builtin.email;
    this.collections = Object.freeze([...(options.collections ?? [])]);
    this.auth = this.resolveAuth(builtin.auth ?? { mode: "manual" }, problems, warnings, options.domain);
    for (const feature of ["account", "admin"] as const) {
      if (this[feature].mode === "builtin" && this.auth.mode !== "builtin") {
        problems.push(`builtinConfig.${feature} is 'builtin', which needs builtinConfig.auth in 'builtin' mode (it works on the user model).`);
      }
    }

    const needsJwt =
      this.auth.mode === "builtin" ||
      this.auth.oauth !== undefined ||
      this.auth.mfa !== undefined ||
      this.account.mode === "builtin" ||
      this.collections.some((c) => c.type === "auth" || c.type === "account");
    if (needsJwt) {
      if (!this.jwtSecret) {
        problems.push("jwtSecret is required for authentication. Generate one with generateJWTSecret().");
      } else if (this.jwtSecret.length < MIN_SECRET_LENGTH) {
        problems.push(`jwtSecret must be at least ${MIN_SECRET_LENGTH} characters long.`);
      }
    }

    if (!needsJwt) {
      const locked = this.collections
        .filter((c) => c.type === "crud" && c.routes.some((r) => (r.auth ?? "authenticated") !== "public"))
        .map((c) => `'${c.route}'`);
      if (locked.length > 0) {
        warnings.push(
          `Collections ${locked.join(", ")} have routes that require sign-in, but no authentication is configured, so those routes reject every request. Set builtinConfig.auth (and jwtSecret), or mark the routes auth: "public".`,
        );
      }
    }

    const usesOtp = this.auth.signupMode === "otp" || this.auth.loginMode === "otp";
    if (this.auth.mode === "builtin" && usesOtp && !this.isOffline) {
      if (!this.resendAPIKey) problems.push("resendAPIKey is required for OTP authentication when isOffline is false.");
      if (!this.systemEmailSender) problems.push("systemEmailSender is required for OTP authentication when isOffline is false.");
    }

    const usesEncryption = this.collections.some((c) =>
      c.routes.some((r) => (r.encryptedFields?.length ?? 0) > 0 || (r.decryptedFields?.length ?? 0) > 0),
    );
    if (usesEncryption && !this.masterKey) {
      problems.push("masterKey is required because a route uses encryptedFields or decryptedFields. Generate one with generateMasterKey().");
    }

    const usesCloudinary = this.collections.some((c) =>
      c.routes.some((r) => r.files?.some((f) => (f.provider ?? "cloudinary") === "cloudinary")),
    );
    if (usesCloudinary) {
      const { apiKey, apiSecret, cloudName } = this.cloudinary;
      if (!apiKey || !apiSecret || !cloudName) {
        problems.push("cloudinaryAPIKey, cloudinaryAPISecret and cloudinaryCloudName are required when a route accepts file uploads.");
      }
    }

    if (this.corsConfig?.origin === "*" && this.corsConfig.credentials) {
      warnings.push("corsConfig: origin '*' together with credentials is unsafe. List your front-end origins explicitly.");
    }
    // The placeholders only matter when real e-mail goes out: built-in sign-in sends codes and links, an emailAction sends templates.
    // Offline, nothing is delivered (the console provider logs only the recipient and the subject), so the warning would be noise.
    const sendsEmail =
      !this.isOffline &&
      (this.auth.mode === "builtin" ||
        this.collections.some((c) =>
          c.routes.some((r) =>
            [...(r.actions?.before ?? []), ...(r.actions?.after ?? [])].some((a) => typeof a === "object" && a !== null && "emailAction" in a),
          ),
        ));
    if (!this.email && sendsEmail) {
      warnings.push("builtinConfig.email was not provided: e-mail templates may contain undefined values.");
    }
    if (this.admin.mode === "builtin") {
      warnings.push("builtinConfig.admin is deprecated: GET /account/role returns the role of any signed-in user (admins included). GET /admin/check keeps working for now.");
    }

    if (problems.length > 0) {
      throw new ConfigurationError({
        message: `Invalid Forge configuration:\n - ${problems.join("\n - ")}`,
        details: { problems },
        hint: "Fix the listed options in new Forge({...}).",
      });
    }
    this.warnings = Object.freeze(warnings);
  }

  /** Alias kept so code can read `config.apiPrefix` or build a path from it. */
  path(...segments: string[]): string {
    return [this.apiPrefix, ...segments.map((s) => s.replace(/^\/+|\/+$/g, ""))].filter(Boolean).join("/");
  }

  private parseDuration(value: string, name: string, problems: string[]): Duration {
    try {
      return Duration.parse(value);
    } catch {
      problems.push(`${name} "${value}" is not a valid duration (examples: "30s", "15m", "1d").`);
      return Duration.ofMs(0);
    }
  }

  private resolveAuth(auth: AuthConfig, problems: string[], warnings: string[], legacyDomain?: string): ResolvedAuthConfig {
    const otp: OtpOptions = auth.otp ?? {};
    const cookie: CookieOptions = auth.cookie ?? {};
    const fields: AuthFieldNames = {
      email: auth.fieldsObj?.email ?? "email",
      password: auth.fieldsObj?.password ?? "password",
      otp: auth.fieldsObj?.otp ?? "otp",
      purpose: auth.fieldsObj?.purpose ?? "purpose",
    };

    if (auth.mode === "builtin") {
      const placeholder = (key: string, value: unknown) => {
        if (typeof value === "string" && value.startsWith("[")) {
          problems.push(`auth.${key} "${value}" is just a placeholder. Use a real value.`);
        }
      };
      Object.entries(fields).forEach(([k, v]) => placeholder(`fieldsObj.${k}`, v));
      if (!auth.mongooseConfig) {
        problems.push("auth.mongooseConfig is required when auth.mode is 'builtin'.");
      } else {
        placeholder("mongooseConfig.model", auth.mongooseConfig.model);
        if (!auth.mongooseConfig.model) problems.push("auth.mongooseConfig.model is required.");
        if (!auth.mongooseConfig.schema) problems.push("auth.mongooseConfig.schema is required.");
        for (const key of [fields.email, fields.password]) {
          if (auth.mongooseConfig.schema && !(key in auth.mongooseConfig.schema)) {
            problems.push(`auth.mongooseConfig.schema must define the '${key}' field.`);
          }
        }
      }
    }

    // 1.x configured the cookie domain with the top-level `domain` option, and only applied it in production.
    const legacy = !cookie.domain ? legacyDomain : undefined;
    const cookieDomain = cookie.domain ?? (this.isProduction ? legacy : undefined);
    if (legacy) {
      warnings.push(
        this.isProduction
          ? "domain is deprecated: set builtinConfig.auth.cookie.domain instead. It is used as the Domain attribute of the auth cookies."
          : "domain is deprecated and, as in 1.x, only applies in production: set builtinConfig.auth.cookie.domain instead.",
      );
    }
    const checkedDomain = cookie.domain ?? legacyDomain;
    if (checkedDomain !== undefined && !COOKIE_DOMAIN.test(checkedDomain)) {
      problems.push(`auth.cookie.domain "${checkedDomain}" must be a host name such as "example.com" or ".example.com" (no scheme, port or path).`);
    }

    const sameSite = cookie.sameSite ?? (this.isProduction ? "none" : "lax");
    const secure = cookie.secure ?? this.isProduction;
    if (sameSite === "none" && !secure) {
      problems.push("auth.cookie: sameSite 'none' requires secure cookies (HTTPS).");
    }
    if (this.isProduction && !secure) {
      warnings.push("auth.cookie.secure is false in production. Cookies will be sent over plain HTTP.");
    }

    const parse = (v: string | undefined, fallback: string, name: string) =>
      this.parseDuration(v ?? fallback, name, problems);

    const maxAttempts = otp.maxAttempts ?? 5;
    const maxResends = otp.maxResends ?? 5;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) problems.push("auth.otp.maxAttempts must be a positive integer.");
    if (!Number.isInteger(maxResends) || maxResends < 0) problems.push("auth.otp.maxResends must be zero or a positive integer.");

    const oauth = this.resolveOAuth(auth, problems);

    return {
      mode: auth.mode,
      ownerField: auth.ownerField ?? "owner",
      returnAccessToken: auth.returnAccessToken ?? false,
      returnRefreshToken: auth.returnRefreshToken ?? false,
      rotateRefreshToken: auth.rotateRefreshToken ?? true,
      refreshTokenRotationInterval: parse(auth.refreshTokenRotationInterval, "0s", "auth.refreshTokenRotationInterval"),
      refreshReuseGracePeriod: parse(auth.refreshReuseGracePeriod, "10s", "auth.refreshReuseGracePeriod"),
      verifyAccessUser: auth.verifyAccessUser ?? true,
      fields,
      mongooseConfig: auth.mongooseConfig,
      accessTokenName: auth.accessTokenName ?? "accessToken",
      refreshTokenName: auth.refreshTokenName ?? "refreshToken",
      accessTokenAge: parse(auth.accessTokenAge, "10m", "auth.accessTokenAge"),
      refreshTokenAge: parse(auth.refreshTokenAge, "30d", "auth.refreshTokenAge"),
      signupMode: auth.signupMode ?? "otp",
      loginMode: auth.loginMode ?? "otp",
      otp: {
        expiresIn: parse(otp.expiresIn, "5m", "auth.otp.expiresIn"),
        maxAttempts,
        resendCooldown: parse(otp.resendCooldown, "60s", "auth.otp.resendCooldown"),
        maxResends,
        verifiedWindow: parse(otp.verifiedWindow, "10m", "auth.otp.verifiedWindow"),
      },
      cookie: {
        sameSite,
        secure,
        path: cookie.path ?? "/",
        ...(cookieDomain ? { domain: cookieDomain } : {}),
      },
      oauth,
      magicLink: this.resolveMagicLink(auth.magicLink, problems),
      mfa: this.resolveMfa(auth.mfa, problems),
    };
  }

  private resolveMagicLink(options: MagicLinkOptions | undefined, problems: string[]): ResolvedMagicLinkConfig | undefined {
    if (!options) return undefined;

    // The link is built from this URL and e-mailed, so it must point at one of our own front-ends.
    const origins = new Set(this.frontendOrigins.map((o) => o.replace(/\/+$/, "")));
    try {
      const url = new URL(options.url);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocol");
      if (!origins.has(url.origin)) {
        problems.push(`auth.magicLink.url "${options.url}" is not on a configured front-end. Add its origin to frontendURL / frontendURLs.`);
      }
    } catch {
      problems.push("auth.magicLink.url must be an absolute http(s) URL (the front-end page that receives the token).");
    }

    const accountLinking = options.accountLinking ?? "auto";
    if (!["auto", "always", "never"].includes(accountLinking)) problems.push("auth.magicLink.accountLinking must be 'auto', 'always' or 'never'.");

    // Links are delivered by e-mail, so a real mail provider is needed outside offline mode.
    if (!this.isOffline) {
      if (!this.resendAPIKey) problems.push("resendAPIKey is required for magic links when isOffline is false.");
      if (!this.systemEmailSender) problems.push("systemEmailSender is required for magic links when isOffline is false.");
    }

    return {
      url: options.url,
      expiresIn: this.parseDuration(options.expiresIn ?? "15m", "auth.magicLink.expiresIn", problems),
      resendCooldown: this.parseDuration(options.resendCooldown ?? "60s", "auth.magicLink.resendCooldown", problems),
      allowSignup: options.allowSignup ?? true,
      sameDevice: options.sameDevice ?? true,
      accountLinking,
    };
  }

  private resolveMfa(options: MfaOptions | undefined, problems: string[]): ResolvedMfaConfig | undefined {
    if (!options) return undefined;

    if (typeof options.issuer !== "string" || options.issuer.trim() === "") problems.push("auth.mfa.issuer is required (it is shown in the authenticator app).");
    // The TOTP secret has to be readable again to check codes, so it is encrypted (not hashed) with the master key.
    if (!this.masterKey) problems.push("masterKey is required for auth.mfa: authenticator secrets are encrypted at rest. Generate one with generateMasterKey().");

    const maxAttempts = options.maxAttempts ?? 5;
    const recoveryCodes = options.recoveryCodes ?? 10;
    const window = options.window ?? 1;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) problems.push("auth.mfa.maxAttempts must be a positive integer.");
    if (!Number.isInteger(recoveryCodes) || recoveryCodes < 1 || recoveryCodes > 50) problems.push("auth.mfa.recoveryCodes must be between 1 and 50.");
    if (!Number.isInteger(window) || window < 0 || window > 5) problems.push("auth.mfa.window must be between 0 and 5.");

    return {
      issuer: options.issuer?.trim() ?? "",
      challengeAge: this.parseDuration(options.challengeAge ?? "5m", "auth.mfa.challengeAge", problems),
      maxAttempts,
      lockoutDuration: this.parseDuration(options.lockoutDuration ?? "5m", "auth.mfa.lockoutDuration", problems),
      recoveryCodes,
      window,
    };
  }

  private resolveOAuth(auth: AuthConfig, problems: string[]): ResolvedOAuthConfig | undefined {
    const oauth = auth.oauth;
    if (!oauth) return undefined;

    if (!Array.isArray(oauth.providers) || oauth.providers.length === 0) {
      problems.push("auth.oauth.providers must list at least one provider.");
    }
    const seen = new Set<string>();
    for (const entry of oauth.providers ?? []) {
      const name = OAuthProviderFactory.nameOf(entry);
      if (seen.has(name)) problems.push(`auth.oauth.providers lists '${name}' twice.`);
      seen.add(name);
      if (!("buildAuthorizationUrl" in entry)) {
        if (!entry.clientId) problems.push(`auth.oauth.providers['${name}'].clientId is required.`);
        if (!entry.clientSecret) problems.push(`auth.oauth.providers['${name}'].clientSecret is required.`);
      }
    }

    // Redirect targets must be one of the configured front-ends, otherwise the callback is an open redirect.
    const origins = new Set(this.frontendOrigins.map((o) => o.replace(/\/+$/, "")));
    for (const key of ["successRedirect", "failureRedirect"] as const) {
      const value = oauth[key];
      if (value === undefined) continue;
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocol");
        if (!origins.has(url.origin)) {
          problems.push(`auth.oauth.${key} "${value}" is not on a configured front-end. Add its origin to frontendURL / frontendURLs.`);
        }
      } catch {
        problems.push(`auth.oauth.${key} must be an absolute http(s) URL.`);
      }
    }

    const accountLinking = oauth.accountLinking ?? "auto";
    if (!["auto", "always", "never"].includes(accountLinking)) problems.push("auth.oauth.accountLinking must be 'auto', 'always' or 'never'.");

    return {
      providers: Object.freeze([...(oauth.providers ?? [])]),
      successRedirect: oauth.successRedirect,
      failureRedirect: oauth.failureRedirect,
      accountLinking,
      stateAge: this.parseDuration(oauth.stateAge ?? "10m", "auth.oauth.stateAge", problems),
      userFromProfile: oauth.userFromProfile,
    };
  }
}

type ForgeOptionsStore = NonNullable<ForgeOptions["rateLimitStore"]> | undefined;
