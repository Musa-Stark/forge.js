import { newObjectId } from "../utils/ids.js";
import { referenceOf } from "../data/references.js";
import type { Doc, FindOptions, Filter, ModelDefinition, PopulateOption, Repository } from "../data/Repository.js";

type FieldDef = {
  type?: unknown;
  required?: boolean;
  default?: unknown;
  lowercase?: boolean;
  trim?: boolean;
  minlength?: number;
  maxlength?: number;
  unique?: boolean;
  select?: boolean;
  ref?: string;
  enum?: unknown[];
};

type Resolver = (model: string) => Repository | undefined;

const clone = <T>(value: T): T => structuredClone(value);

const asDef = (field: unknown): FieldDef | undefined => {
  if (typeof field !== "object" || field === null || Array.isArray(field)) return undefined;
  const f = field as { mongoose?: unknown } & FieldDef;
  return (f.mongoose && typeof f.mongoose === "object" && !Array.isArray(f.mongoose) ? f.mongoose : f) as FieldDef;
};

/**
 * A small in-memory {@link Repository} that mimics the Mongoose behaviours
 * Forge depends on: defaults, `required`, `lowercase`/`trim`, unique indexes
 * (throwing the same E11000 shape), `select: false` fields and `populate`.
 * Meant for tests - it is not a database.
 */
export class InMemoryRepository implements Repository {
  private readonly rows = new Map<string, Doc>();
  private readonly fields: Record<string, FieldDef | undefined>;
  /** The model each reference field points at, for `populate`. */
  private readonly references: Record<string, string | undefined>;
  private readonly unique: string[][];
  private readonly secrets: Set<string>;

  constructor(
    readonly name: string,
    definition: ModelDefinition,
    private readonly resolve: Resolver,
  ) {
    this.fields = Object.fromEntries(Object.entries(definition.schema).map(([k, v]) => [k, asDef(v)]));
    this.references = Object.fromEntries(
      Object.entries(definition.schema).map(([k, v]) => {
        const ref = referenceOf(v)?.ref;
        return [k, typeof ref === "string" ? ref : undefined];
      }),
    );
    this.secrets = new Set(Object.entries(this.fields).filter(([, d]) => d?.select === false).map(([k]) => k));
    this.unique = [
      ...Object.entries(this.fields).filter(([, d]) => d?.unique).map(([k]) => [k]),
      ...(definition.indexes ?? []).filter((i) => i.unique).map((i) => Object.keys(i.fields)),
    ];
  }

  async findById(id: string, options: FindOptions = {}): Promise<Doc | null> {
    return this.findOne({ _id: id }, options);
  }

  async findOne(filter: Filter, options: FindOptions = {}): Promise<Doc | null> {
    const found = [...this.rows.values()].find((row) => this.matches(row, filter));
    return found ? this.read(found, options) : null;
  }

  async find(filter: Filter, options: FindOptions = {}): Promise<Doc[]> {
    let rows = [...this.rows.values()].filter((row) => this.matches(row, filter));
    if (options.sort) {
      const entries = Object.entries(options.sort);
      rows = rows.sort((a, b) => {
        for (const [key, dir] of entries) {
          const x = a[key] as number | string | Date | undefined;
          const y = b[key] as number | string | Date | undefined;
          if (x === y) continue;
          return (x! < y! ? -1 : 1) * dir;
        }
        return 0;
      });
    }
    if (options.skip) rows = rows.slice(options.skip);
    if (options.limit) rows = rows.slice(0, options.limit);
    return Promise.all(rows.map((row) => this.read(row, options)));
  }

  async count(filter: Filter): Promise<number> {
    return [...this.rows.values()].filter((row) => this.matches(row, filter)).length;
  }

  async create(data: Record<string, unknown>): Promise<Doc> {
    const doc = this.prepare(data);
    this.assertUnique(doc);
    this.rows.set(doc._id, doc);
    return clone(doc);
  }

  /**
   * Mimics Mongoose's `insertMany` with `ordered: true`. Every document is validated first, so one invalid
   * document inserts nothing. The documents are then inserted in order, and a unique-index violation stops the
   * insert while the documents before it stay saved. MongoDB reports that violation as a bulk write error, which
   * keeps the code and the server message but loses the key pattern.
   */
  async createMany(items: Record<string, unknown>[]): Promise<Doc[]> {
    const prepared = items.map((item) => this.prepare(item));
    const created: Doc[] = [];
    for (const doc of prepared) {
      try {
        this.assertUnique(doc);
      } catch (error) {
        throw this.asBulkWriteError(error);
      }
      this.rows.set(doc._id, doc);
      created.push(clone(doc));
    }
    return created;
  }

  private asBulkWriteError(error: unknown): unknown {
    const { code, keyPattern } = error as { code?: unknown; keyPattern?: Record<string, number> };
    if (code !== 11000 || !keyPattern) return error;
    const index = Object.entries(keyPattern).map(([field, direction]) => `${field}_${direction}`).join("_");
    const message = `E11000 duplicate key error collection: app.${this.name} index: ${index} dup key: { ${Object.keys(keyPattern).join(", ")} }`;
    return Object.assign(new Error(message), { name: "MongoBulkWriteError", code: 11000, writeErrors: [] });
  }

  async updateById(id: string, data: Record<string, unknown>): Promise<Doc | null> {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const next = { ...existing, ...this.normalise(clone(data)), updatedAt: new Date() } as Doc;
    this.assertUnique(next, id);
    this.rows.set(id, next);
    return this.read(next, {});
  }

  async updateMany(filter: Filter, data: Record<string, unknown>): Promise<number> {
    let n = 0;
    for (const row of [...this.rows.values()]) {
      if (this.matches(row, filter)) {
        await this.updateById(row._id, data);
        n++;
      }
    }
    return n;
  }

  async deleteById(id: string): Promise<Doc | null> {
    const existing = this.rows.get(id);
    if (!existing) return null;
    this.rows.delete(id);
    return clone(existing);
  }

  async deleteMany(filter: Filter): Promise<number> {
    let n = 0;
    for (const row of [...this.rows.values()]) {
      if (this.matches(row, filter)) {
        this.rows.delete(row._id);
        n++;
      }
    }
    return n;
  }

  /** Test helper: everything stored, secrets included. */
  dump(): Doc[] {
    return [...this.rows.values()].map(clone);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private matches(row: Doc, filter: Filter): boolean {
    return Object.entries(filter).every(([key, expected]) => {
      const actual = row[key];
      if (expected && typeof expected === "object" && "$in" in (expected as object)) {
        return ((expected as { $in: unknown[] }).$in ?? []).map(String).includes(String(actual));
      }
      return String(actual) === String(expected);
    });
  }

  private prepare(data: Record<string, unknown>): Doc {
    const doc: Record<string, unknown> = { ...clone(data) };
    doc._id = typeof doc._id === "string" ? doc._id : newObjectId();

    for (const [key, def] of Object.entries(this.fields)) {
      if (doc[key] === undefined && def && "default" in def) {
        const d = def.default;
        doc[key] = typeof d === "function" ? (d as () => unknown)() : clone(d);
        if (def.type === Date && typeof doc[key] === "number") doc[key] = new Date(doc[key] as number);
      }
    }
    Object.assign(doc, this.normalise(doc));
    const now = new Date();
    doc.createdAt ??= now;
    doc.updatedAt ??= now;

    this.validate(doc);
    return doc as Doc;
  }

  private normalise(data: Record<string, unknown>): Record<string, unknown> {
    for (const [key, value] of Object.entries(data)) {
      const def = this.fields[key];
      if (typeof value === "string" && def) {
        let v = value;
        if (def.trim) v = v.trim();
        if (def.lowercase) v = v.toLowerCase();
        data[key] = v;
      }
    }
    return data;
  }

  private validate(doc: Record<string, unknown>): void {
    const errors: Record<string, { message: string; kind: string; path: string }> = {};
    for (const [key, def] of Object.entries(this.fields)) {
      if (!def) continue;
      const value = doc[key];
      const missing = value === undefined || value === null || value === "";
      if (def.required && missing) errors[key] = { path: key, kind: "required", message: `Path \`${key}\` is required.` };
      else if (typeof value === "string") {
        if (def.minlength && value.length < def.minlength) errors[key] = { path: key, kind: "minlength", message: `Path \`${key}\` is too short.` };
        if (def.maxlength && value.length > def.maxlength) errors[key] = { path: key, kind: "maxlength", message: `Path \`${key}\` is too long.` };
        if (def.enum && !def.enum.includes(value)) errors[key] = { path: key, kind: "enum", message: `\`${value}\` is not a valid enum value for path \`${key}\`.` };
      }
    }
    if (Object.keys(errors).length > 0) throw Object.assign(new Error(`${this.name} validation failed`), { name: "ValidationError", errors });
  }

  private assertUnique(doc: Doc, ignoreId?: string): void {
    for (const fields of this.unique) {
      const clash = [...this.rows.values()].some(
        (row) => row._id !== (ignoreId ?? doc._id) && fields.every((f) => row[f] !== undefined && String(row[f]) === String(doc[f])),
      );
      if (clash) {
        throw Object.assign(new Error("E11000 duplicate key error"), {
          code: 11000,
          keyPattern: Object.fromEntries(fields.map((f) => [f, 1])),
        });
      }
    }
  }

  private async read(row: Doc, options: FindOptions): Promise<Doc> {
    const copy = clone(row) as Record<string, unknown>;
    for (const secret of this.secrets) if (!options.withSecrets?.includes(secret)) delete copy[secret];
    if (options.populate) await this.populate(copy, options.populate);
    return copy as Doc;
  }

  /**
   * Like Mongoose: `path` may name several fields separated by spaces, a reference to a document that no longer
   * exists becomes `null`, and missing documents are left out of an array of references.
   */
  private async populate(doc: Record<string, unknown>, option: PopulateOption): Promise<void> {
    const wanted = new Set(["_id", ...option.select.split(/\s+/).filter(Boolean)]);
    const pick = (target: Doc): Doc => Object.fromEntries(Object.entries(target).filter(([k]) => wanted.has(k))) as Doc;

    for (const path of option.path.split(/\s+/).filter(Boolean)) {
      const ref = this.references[path];
      const stored = doc[path];
      const repository = ref ? this.resolve(ref) : undefined;
      if (!repository) continue;
      if (Array.isArray(stored)) {
        const found = await Promise.all(stored.map(async (id) => (typeof id === "string" ? repository.findById(id) : null)));
        doc[path] = found.filter((target): target is Doc => target !== null).map(pick);
      } else if (typeof stored === "string") {
        const target = await repository.findById(stored);
        doc[path] = target ? pick(target) : null;
      }
    }
  }
}
