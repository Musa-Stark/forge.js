import type { ForgeConfig } from "../config/ForgeConfig.js";
import type { DataSource } from "../data/Repository.js";
import type { SchemaCompiler } from "../data/SchemaCompiler.js";
import type { EmailService } from "../email/EmailService.js";
import type { Authenticator } from "../http/Authenticator.js";
import type { RateLimiters } from "../http/middleware/RateLimiters.js";
import type { ResponseWriter } from "../http/ResponseWriter.js";
import type { CryptoVault } from "../security/CryptoVault.js";
import type { PasswordHasher } from "../security/PasswordHasher.js";
import type { TokenService } from "../security/TokenService.js";
import type { UploadService } from "../upload/UploadService.js";
import type { CookieWriter } from "../auth/CookieWriter.js";
import type { SessionResponder } from "../auth/SessionResponder.js";
import type { OAuthProviderRegistry } from "../oauth/OAuthProviderRegistry.js";
import type { SessionService } from "../auth/SessionService.js";
import type { Logger } from "../utils/Logger.js";
import type { AccessPolicy } from "./AccessPolicy.js";
import type { ActionRunner } from "./ActionRunner.js";
import type { FieldTransformer } from "./FieldTransformer.js";
import type { Pagination } from "./Pagination.js";
import type { ResponseSanitizer } from "./ResponseSanitizer.js";

/**
 * Every collaborator the feature modules need, built once per Forge instance.
 * Passed explicitly (constructor injection) - there are no module-level singletons.
 */
export interface Services {
  config: ForgeConfig;
  logger: Logger;
  data: DataSource;
  compiler: SchemaCompiler;
  tokens: TokenService;
  hasher: PasswordHasher;
  vault: CryptoVault;
  emails: EmailService;
  uploads: UploadService;
  authenticator: Authenticator;
  responses: ResponseWriter;
  access: AccessPolicy;
  sanitizer: ResponseSanitizer;
  transformer: FieldTransformer;
  actions: ActionRunner;
  pagination: Pagination;
  limiters: RateLimiters;
  sessions: SessionService;
  cookies: CookieWriter;
  sessionResponder: SessionResponder;
  /** Enabled "Sign in with ..." providers. Register more with `services.oauth.register(...)` before `build()`. */
  oauth: OAuthProviderRegistry;
  /** Name of the user model, when authentication is enabled. */
  userModel: string | undefined;
}
