import { Forge } from "./core/Forge.js";
import type { Collection } from "./types/Collection.js";
import type { Route } from "./types/Route.js";

// ── Framework ────────────────────────────────────────────────────────────────
export { Forge } from "./core/Forge.js";
export { FeatureModule, type HandlerFn } from "./core/FeatureModule.js";
export type { Services } from "./core/Services.js";
export type { ForgeDependencies } from "./core/ServiceFactory.js";
export { RouteContext } from "./core/RouteContext.js";

// ── Configuration ────────────────────────────────────────────────────────────
export { ForgeConfig, Duration } from "./config/index.js";
export type {
  ForgeOptions,
  AuthConfig,
  AuthMode,
  DurationType,
  OtpOptions,
  CookieOptions,
} from "./config/index.js";

// ── Errors ───────────────────────────────────────────────────────────────────
export * from "./errors/index.js";

// ── Data layer ───────────────────────────────────────────────────────────────
export type {
  Repository,
  DataSource,
  Doc,
  Filter,
  ModelDefinition,
} from "./data/Repository.js";
export { MongooseDataSource } from "./data/MongooseDataSource.js";

// ── Social sign-in ───────────────────────────────────────────────────────────
export {
  OAuthProvider,
  GoogleProvider,
  GitHubProvider,
  OAuthProviderRegistry,
} from "./oauth/index.js";
export type {
  OAuthClientOptions,
  OAuthProfile,
  OAuthProviderConfig,
  OAuthProviderEntry,
  TokenSet,
  AuthorizationParams,
} from "./oauth/index.js";
export type {
  OAuthOptions,
  AccountLinking,
  MagicLinkOptions,
  MfaOptions,
} from "./config/ForgeOptions.js";

// ── Pluggable providers ──────────────────────────────────────────────────────
export type { EmailProvider, OutgoingEmail } from "./email/EmailProvider.js";
export type {
  StorageProvider,
  IncomingFile,
} from "./upload/StorageProvider.js";

// ── Security helpers ─────────────────────────────────────────────────────────
export {
  generateJWTSecret,
  generateMasterKey,
} from "./security/CryptoVault.js";
export { Totp, base32 } from "./security/Totp.js";
export { PasswordHasher } from "./security/PasswordHasher.js";
export type { CustomTokenClaims } from "./security/TokenService.js";

// ── Field helpers ────────────────────────────────────────────────────────────
export { default as fields } from "./fields/unified.fields.js";
export { default as mongooseFields } from "./fields/mongoose.fields.js";
export { default as zodFields } from "./fields/zod.fields.js";

// ── Types used when declaring collections ────────────────────────────────────
export type { Collection, CollectionType, Route } from "./types/Collection.js";
export type { RouteMethod, AccessLevel, AuthRole } from "./types/Route.js";
export type { Upload, UploadType, UploadProvider } from "./types/upload.js";
export type {
  Action,
  ActionContext,
  CustomAction,
  EmailAction,
} from "./types/ActionHandler.js";
export type { StoreFile } from "./types/StoreFile.js";
export type { AuthenticatedUser } from "./types/AuthenticatedUser.js";
export type { EmailTemplate } from "./types/email.js";

/** Identity helper that gives you autocomplete when declaring a collection. */
export const collection = (object: Collection): Collection => object;

/** Identity helper that gives you autocomplete when declaring routes. */
export const defineRoutes = (routes: Route[]): Route[] => routes;

/**
 * @deprecated Use `new Forge({...})` and `await forge.start()`.
 * Kept so 1.x code (`new StarkForge({...}); startServer();`) keeps working.
 */
export class StarkForge extends Forge {}

/** @deprecated Use `forge.start()`. Starts the most recently created Forge instance. */
export const startServer = async (): Promise<void> => {
  if (!Forge.lastCreated)
    throw new Error("Create a Forge instance first: new Forge({...}).");
  await Forge.lastCreated.start();
};

export default Forge;
