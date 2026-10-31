import { AccessPolicy } from "./AccessPolicy.js";
import { ActionRunner } from "./ActionRunner.js";
import { FieldTransformer } from "./FieldTransformer.js";
import { Pagination } from "./Pagination.js";
import { ResponseSanitizer } from "./ResponseSanitizer.js";
import type { Services } from "./Services.js";
import { CookieWriter } from "../auth/CookieWriter.js";
import { SessionResponder } from "../auth/SessionResponder.js";
import { OAuthProviderFactory } from "../oauth/OAuthProviderFactory.js";
import { SessionService } from "../auth/SessionService.js";
import type { ForgeConfig } from "../config/ForgeConfig.js";
import { MongooseDataSource } from "../data/MongooseDataSource.js";
import type { DataSource } from "../data/Repository.js";
import { SchemaCompiler } from "../data/SchemaCompiler.js";
import { ConsoleProvider } from "../email/ConsoleProvider.js";
import type { EmailProvider } from "../email/EmailProvider.js";
import { EmailService } from "../email/EmailService.js";
import { ResendProvider } from "../email/ResendProvider.js";
import { Authenticator } from "../http/Authenticator.js";
import { RateLimiters } from "../http/middleware/RateLimiters.js";
import { ResponseWriter } from "../http/ResponseWriter.js";
import { CryptoVault } from "../security/CryptoVault.js";
import { PasswordHasher } from "../security/PasswordHasher.js";
import { TokenService } from "../security/TokenService.js";
import { CloudinaryStorage } from "../upload/CloudinaryStorage.js";
import type { StorageProvider } from "../upload/StorageProvider.js";
import { UploadService } from "../upload/UploadService.js";
import { ConsoleSink, Logger } from "../utils/Logger.js";

/** Replace any collaborator - mostly useful in tests (fake database, fake mailer, fake storage). */
export interface ForgeDependencies {
  logger?: Logger;
  dataSource?: DataSource;
  emailProvider?: EmailProvider;
  storageProviders?: StorageProvider[];
  /** `fetch` used by the built-in OAuth providers (tests, proxies). */
  fetch?: typeof fetch;
}

/** Builds the object graph once, from the validated configuration. */
export class ServiceFactory {
  create(config: ForgeConfig, deps: ForgeDependencies = {}): Services {
    const logger = deps.logger ?? new Logger(config.isTest ? "silent" : config.isProduction ? "info" : "debug", new ConsoleSink());

    const userModel =
      config.auth.mode === "builtin"
        ? config.auth.mongooseConfig?.model
        : config.collections.find((c) => c.type === "auth")?.model;

    const data =
      deps.dataSource ??
      new MongooseDataSource({
        uri: config.isOffline ? (config.mongoDBURI ?? "mongodb://127.0.0.1:27017") : (config.mongoDBURI as string),
        databaseName: config.databaseName,
        logger,
      });

    const compiler = new SchemaCompiler();
    const tokens = new TokenService(config.jwtSecret);
    const hasher = new PasswordHasher();
    const vault = new CryptoVault(config.masterKey);
    const responses = new ResponseWriter();

    const provider: EmailProvider =
      deps.emailProvider ??
      (config.resendAPIKey && !config.isOffline ? new ResendProvider(config.resendAPIKey) : new ConsoleProvider(logger));
    const emails = new EmailService(config, provider);

    const storage: StorageProvider[] = deps.storageProviders ?? [];
    const { apiKey, apiSecret, cloudName, folder } = config.cloudinary;
    if (!deps.storageProviders && apiKey && apiSecret && cloudName) {
      storage.push(new CloudinaryStorage({ apiKey, apiSecret, cloudName, folder }));
    }
    const uploads = new UploadService(config, logger, storage);

    const authenticator = new Authenticator(config, tokens, data);
    const sanitizer = new ResponseSanitizer();
    const cookies = new CookieWriter(config);
    const oauth = new OAuthProviderFactory().createRegistry(
      config.auth.oauth?.providers ?? [],
      deps.fetch ? { fetch: deps.fetch } : {},
    );

    return {
      config,
      logger,
      data,
      compiler,
      tokens,
      hasher,
      vault,
      emails,
      uploads,
      authenticator,
      responses,
      access: new AccessPolicy(config, authenticator),
      sanitizer,
      transformer: new FieldTransformer(vault, hasher),
      actions: new ActionRunner(emails, logger),
      pagination: new Pagination(config),
      limiters: new RateLimiters(config),
      sessions: new SessionService(config, tokens, data, logger),
      cookies,
      sessionResponder: new SessionResponder(config, cookies, sanitizer, responses),
      oauth,
      userModel,
    };
  }
}
