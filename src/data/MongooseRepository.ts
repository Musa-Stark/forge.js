import mongoose, { type Model } from "mongoose";
import type { Doc, FindOptions, Filter, Repository } from "./Repository.js";

/** Recursively converts ObjectIds to strings and drops Mongoose internals. */
export const toPlain = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toHexString();
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map(toPlain);
  if (value instanceof Map) return Object.fromEntries([...value].map(([k, v]) => [k, toPlain(v)]));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) out[key] = toPlain(v);
    return out;
  }
  return value;
};

/** {@link Repository} backed by a Mongoose model. */
export class MongooseRepository implements Repository {
  constructor(
    readonly name: string,
    private readonly model: Model<any>,
  ) {}

  get native(): Model<any> {
    return this.model;
  }

  async findById(id: string, options: FindOptions = {}): Promise<Doc | null> {
    return this.findOne({ _id: id }, options);
  }

  async findOne(filter: Filter, options: FindOptions = {}): Promise<Doc | null> {
    const query = this.model.findOne(filter);
    this.applyOptions(query, options);
    return this.plain(await query.lean());
  }

  async find(filter: Filter, options: FindOptions = {}): Promise<Doc[]> {
    const query = this.model.find(filter);
    this.applyOptions(query, options);
    const rows = await query.lean();
    return rows.map((row) => this.plain(row) as Doc);
  }

  count(filter: Filter): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  async create(data: Record<string, unknown>): Promise<Doc> {
    const created = await this.model.create(data);
    return this.plain(created.toObject({ flattenMaps: true })) as Doc;
  }

  async createMany(items: Record<string, unknown>[]): Promise<Doc[]> {
    const created = await this.model.insertMany(items, { ordered: true });
    return created.map((doc) => this.plain(doc.toObject({ flattenMaps: true })) as Doc);
  }

  async updateById(id: string, data: Record<string, unknown>): Promise<Doc | null> {
    const updated = await this.model
      .findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true, context: "query" })
      .lean();
    return this.plain(updated);
  }

  async updateMany(filter: Filter, data: Record<string, unknown>): Promise<number> {
    const result = await this.model.updateMany(filter, { $set: data }).exec();
    return result.modifiedCount;
  }

  async deleteById(id: string): Promise<Doc | null> {
    return this.plain(await this.model.findByIdAndDelete(id).lean());
  }

  async deleteMany(filter: Filter): Promise<number> {
    const result = await this.model.deleteMany(filter).exec();
    return result.deletedCount;
  }

  private applyOptions(query: any, options: FindOptions): void {
    if (options.withSecrets?.length) query.select(options.withSecrets.map((f) => `+${f}`).join(" "));
    if (options.populate) query.populate({ path: options.populate.path, select: options.populate.select });
    if (options.sort) query.sort(options.sort);
    if (options.skip) query.skip(options.skip);
    if (options.limit) query.limit(options.limit);
  }

  private plain(value: unknown): Doc | null {
    return value ? (toPlain(value) as Doc) : null;
  }
}
