import mongoose, { Schema, type Connection } from "mongoose";
import { ConfigurationError, ErrorCode, ServiceUnavailableError } from "../errors/index.js";
import type { Logger } from "../utils/Logger.js";
import { MongooseRepository } from "./MongooseRepository.js";
import type { DataSource, ModelDefinition, Repository } from "./Repository.js";
import { SchemaCompiler } from "./SchemaCompiler.js";

export interface MongooseDataSourceOptions {
  uri: string;
  databaseName: string;
  logger: Logger;
  /** How long to wait for the server before giving up. @default 10000 */
  serverSelectionTimeoutMS?: number;
}

/**
 * MongoDB persistence through Mongoose.
 *
 * Owns a private connection (`createConnection`) instead of the global
 * `mongoose.connect`, so several Forge instances can live in one process.
 */
export class MongooseDataSource implements DataSource {
  private readonly compiler = new SchemaCompiler();
  private readonly repositories = new Map<string, MongooseRepository>();
  private connection: Connection | undefined;
  private opened = false;

  constructor(private readonly options: MongooseDataSourceOptions) {}

  async connect(): Promise<void> {
    if (this.opened) return;
    try {
      await this.getConnection().openUri(this.options.uri, {
        dbName: this.options.databaseName,
        serverSelectionTimeoutMS: this.options.serverSelectionTimeoutMS ?? 10_000,
        autoIndex: true,
      });
      this.opened = true;
    } catch (cause) {
      throw new ServiceUnavailableError({
        message: "Could not connect to MongoDB.",
        code: ErrorCode.DATABASE_UNAVAILABLE,
        hint: "Check 'mongoDBURI' and that the database accepts connections from this machine.",
        cause,
      });
    }
    this.options.logger.info(`Connected to MongoDB database "${this.options.databaseName}".`);
    // Make sure indexes (including TTL) exist before serving traffic.
    await Promise.all([...this.repositories.values()].map((repo) => repo.native.init()));
  }

  async disconnect(): Promise<void> {
    await this.connection?.close();
    this.connection = undefined;
    this.opened = false;
  }

  register(definition: ModelDefinition): Repository {
    const existing = this.repositories.get(definition.name);
    if (existing) return existing;

    const schema = new Schema(this.compiler.toMongooseDefinition(definition.schema) as never, {
      timestamps: true,
      strict: true,
    });
    for (const index of definition.indexes ?? []) {
      schema.index(index.fields, {
        ...(index.unique ? { unique: true } : {}),
        ...(index.expireAfterSeconds !== undefined ? { expireAfterSeconds: index.expireAfterSeconds } : {}),
      });
    }

    const model = this.getConnection().model(definition.name, schema as Schema<any>);
    const repo = new MongooseRepository(definition.name, model);
    this.repositories.set(definition.name, repo);
    return repo;
  }

  repository(modelName: string): Repository {
    const repo = this.repositories.get(modelName);
    if (!repo) {
      throw new ConfigurationError({
        message: `Model '${modelName}' is not registered.`,
        hint: "Declare it with a collection that has a 'model' and a 'schema'.",
      });
    }
    return repo;
  }

  has(modelName: string): boolean {
    return this.repositories.has(modelName);
  }

  nativeModel(modelName: string): unknown {
    return this.repositories.get(modelName)?.native;
  }

  async ping(): Promise<boolean> {
    try {
      const db = this.connection?.db;
      if (!db || this.connection?.readyState !== 1) return false;
      await db.admin().ping();
      return true;
    } catch {
      return false;
    }
  }

  private getConnection(): Connection {
    // Models can be registered before connecting: createConnection() without a URI is lazy.
    this.connection ??= mongoose.createConnection();
    return this.connection;
  }
}
