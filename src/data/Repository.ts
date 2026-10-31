
/** A stored document as plain JSON-friendly data. Ids are always strings. */
export type Doc = Record<string, any> & { _id: string };

/**
 * Query filter. Forge only builds filters from a small, safe vocabulary:
 * field equality and `{ $in: [...] }`. Custom repositories must support both.
 */
export type Filter = Record<string, unknown>;

export interface PopulateOption {
  path: string;
  /** Space separated fields of the referenced document to include. */
  select: string;
}

export interface FindOptions {
  populate?: PopulateOption | undefined;
  sort?: Record<string, 1 | -1> | undefined;
  skip?: number | undefined;
  limit?: number | undefined;
  /** Fields hidden by default (`select: false`) that this query needs, e.g. `["password"]`. */
  withSecrets?: readonly string[] | undefined;
}

/**
 * Everything Forge needs from a database, for one model.
 *
 * Controllers depend on this interface - not on Mongoose - so the persistence
 * layer can be swapped or faked in tests without touching business logic.
 */
export interface Repository {
  readonly name: string;
  findById(id: string, options?: FindOptions): Promise<Doc | null>;
  findOne(filter: Filter, options?: FindOptions): Promise<Doc | null>;
  find(filter: Filter, options?: FindOptions): Promise<Doc[]>;
  count(filter: Filter): Promise<number>;
  create(data: Record<string, unknown>): Promise<Doc>;
  createMany(items: Record<string, unknown>[]): Promise<Doc[]>;
  /** Applies a partial update (validators on). Resolves `null` when no document matches. */
  updateById(id: string, data: Record<string, unknown>): Promise<Doc | null>;
  updateMany(filter: Filter, data: Record<string, unknown>): Promise<number>;
  deleteById(id: string): Promise<Doc | null>;
  deleteMany(filter: Filter): Promise<number>;
}

export interface IndexDefinition {
  fields: Record<string, 1 | -1>;
  unique?: boolean;
  /** Delete documents automatically this many seconds after the indexed date (`0` = at that date). */
  expireAfterSeconds?: number;
}

export interface ModelDefinition {
  name: string;
  /** Field definitions: Mongoose fields or unified `{ mongoose, zod }` fields. */
  schema: Record<string, unknown>;
  indexes?: IndexDefinition[];
}

/** A database. Implemented by {@link MongooseDataSource}; faked in `@starklabs/forge/testing`. */
export interface DataSource {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Registers (or returns the already registered) model and gives access to it. */
  register(definition: ModelDefinition): Repository;
  repository(modelName: string): Repository;
  has(modelName: string): boolean;
  /** Cheap liveness probe used by the health endpoint. */
  ping(): Promise<boolean>;
  /** Mongoose models by name, when backed by Mongoose (for advanced actions). */
  nativeModel?(modelName: string): unknown;
}
