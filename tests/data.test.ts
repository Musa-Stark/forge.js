import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MongooseDataSource } from "../src/data/MongooseDataSource.js";
import { toPlain } from "../src/data/MongooseRepository.js";
import { SchemaCompiler } from "../src/data/SchemaCompiler.js";
import { otpRequestModel, refreshTokenModel } from "../src/data/internalModels.js";
import fields from "../src/fields/unified.fields.js";
import { InMemoryDataSource } from "../src/testing/index.js";
import { Logger } from "../src/utils/Logger.js";
import { newObjectId } from "../src/utils/ids.js";

describe("SchemaCompiler", () => {
  const compiler = new SchemaCompiler();

  it("unwraps unified fields and passes plain Mongoose fields through", () => {
    const def = compiler.toMongooseDefinition({ email: fields.email, plain: { type: String } });
    expect(def.email).toEqual(fields.email.mongoose);
    expect(def.plain).toEqual({ type: String });
  });

  it("rejects a wrapped field that has only one half, naming the field", () => {
    expect(() => compiler.toMongooseDefinition({ sku: { mongoose: { type: String } } as never })).toThrow(/'sku' has only one of 'mongoose' and 'zod'/);
    expect(() => compiler.toMongooseDefinition({ sku: { zod: z.string() } as never })).toThrow(/'sku' has only one of/);
    // A plain nested path that happens to be called "zod" together with other keys is left alone.
    expect(compiler.toMongooseDefinition({ nested: { zod: { type: String }, other: { type: Number } } as never }).nested).toEqual({ zod: { type: String }, other: { type: Number } });
  });

  it("accepts a wrapped field with both halves", () => {
    const sku = { mongoose: { type: String, unique: true, sparse: true }, zod: z.string().optional() };
    expect(compiler.toMongooseDefinition({ sku }).sku).toEqual({ type: String, unique: true, sparse: true });
  });

  it("finds fields declared with select:false", () => {
    expect(compiler.secretFieldsOf({ email: fields.email, password: fields.password, other: { type: String, select: false } })).toEqual(["password", "other"]);
  });

  it("builds Zod objects from Zod types and unified fields", () => {
    const schema = compiler.toZodObject({ a: z.string(), email: fields.email }, "t");
    expect(schema.safeParse({ a: "x", email: "a@b.co" }).success).toBe(true);
    expect(schema.safeParse({ a: "x", email: "bad" }).success).toBe(false);
    expect(schema.parse({ a: "x", email: "a@b.co", extra: 1 })).toEqual({ a: "x", email: "a@b.co" });
  });

  it("rejects rules that are neither Zod nor unified, naming the field", () => {
    expect(() => compiler.toZodObject({ bad: { type: String } as never }, "users.create")).toThrow(/users\.create.*bad/);
  });

  it("compiles every named validation group", () => {
    const map = compiler.compileValidations({ a: { x: z.string() }, b: {} }, "r");
    expect([...map.keys()]).toEqual(["a", "b"]);
    expect(compiler.compileValidations(undefined, "r").size).toBe(0);
  });

  it("exposes the Zod type of a unified field", () => {
    expect(compiler.zodOf(fields.email)).toBeDefined();
    expect(compiler.zodOf({ type: String } as never)).toBeUndefined();
  });
});

describe("password field definition (real Mongoose schema, no database)", () => {
  const model = () => {
    const schema = new mongoose.Schema(new SchemaCompiler().toMongooseDefinition({ email: fields.email, password: fields.password }) as never);
    return mongoose.createConnection().model<any>(`U${newObjectId()}`, schema);
  };

  it("is hidden from queries by default", () => {
    expect(model().schema.path("password").options.select).toBe(false);
  });

  it("enforces 8-128 characters", async () => {
    const User = model();
    const kind = async (password: string) => {
      try {
        await new User({ email: "a@b.co", password }).validate();
        return undefined;
      } catch (error) {
        return (error as mongoose.Error.ValidationError).errors.password?.kind;
      }
    };
    expect(await kind("short")).toBe("minlength");
    expect(await kind("a".repeat(129))).toBe("maxlength");
    expect(await kind("a".repeat(8))).toBeUndefined();
  });
});

describe("toPlain", () => {
  it("converts ObjectIds (nested, in arrays and maps) to strings and keeps everything else", () => {
    const id = new mongoose.Types.ObjectId();
    const when = new Date();
    const out = toPlain({ _id: id, owner: { _id: id }, list: [id, { n: id }], map: new Map([["k", id]]), when, buf: Buffer.from("x"), n: 1, s: "s", nil: null, u: undefined }) as any;
    expect(out._id).toBe(id.toHexString());
    expect(out.owner._id).toBe(id.toHexString());
    expect(out.list).toEqual([id.toHexString(), { n: id.toHexString() }]);
    expect(out.map).toEqual({ k: id.toHexString() });
    expect(out.when).toBe(when);
    expect(Buffer.isBuffer(out.buf)).toBe(true);
    expect(out).toMatchObject({ n: 1, s: "s", nil: null });
  });
});

describe("MongooseDataSource (without a server)", () => {
  const make = () => new MongooseDataSource({ uri: "mongodb://127.0.0.1:1", databaseName: "t", logger: Logger.silent(), serverSelectionTimeoutMS: 300 });

  it("registers models lazily and returns the same repository for the same name", () => {
    const ds = make();
    const a = ds.register({ name: "Thing", schema: { name: { type: String } } });
    expect(ds.register({ name: "Thing", schema: { name: { type: String } } })).toBe(a);
    expect(ds.has("Thing")).toBe(true);
    expect(ds.repository("Thing")).toBe(a);
    expect(ds.nativeModel("Thing")).toBeDefined();
    expect(ds.has("Nope")).toBe(false);
  });

  it("explains an unregistered model", () => {
    expect(() => make().repository("Ghost")).toThrow(/not registered/);
  });

  it("reports not-connected as unhealthy and disconnects safely", async () => {
    const ds = make();
    expect(await ds.ping()).toBe(false);
    await expect(ds.disconnect()).resolves.toBeUndefined();
  });

  it("fails with 503 DATABASE_UNAVAILABLE and a hint when the server is unreachable", async () => {
    const ds = make();
    ds.register({ name: "Thing", schema: {} });
    await expect(ds.connect()).rejects.toMatchObject({ statusCode: 503, code: "DATABASE_UNAVAILABLE", hint: expect.stringContaining("mongoDBURI") });
    await ds.disconnect();
  });

  it("compiles the internal models, including TTL indexes", () => {
    const ds = make();
    ds.register({ name: "User", schema: { email: { type: String } } });
    ds.register(refreshTokenModel("User"));
    ds.register(otpRequestModel());
    const indexes = (name: string) => (ds.nativeModel(name) as mongoose.Model<any>).schema.indexes();
    expect(indexes("ForgeRefreshToken").some(([, o]) => o.expireAfterSeconds === 0)).toBe(true);
    expect(indexes("ForgeOtpRequest").some(([f, o]) => o.unique && "email" in f && "purpose" in f)).toBe(true);
    expect(indexes("ForgeOtpRequest").some(([, o]) => o.expireAfterSeconds === 0)).toBe(true);
    const schema = (ds.nativeModel("ForgeRefreshToken") as mongoose.Model<any>).schema;
    expect(schema.path("tokenHash").options.select).toBe(false);
  });
});

describe("InMemoryRepository mirrors the Mongoose behaviours Forge relies on", () => {
  const make = () => {
    const ds = new InMemoryDataSource();
    const users = ds.register({
      name: "User",
      schema: { email: { type: String, required: true, lowercase: true, trim: true, unique: true }, name: { type: String, minlength: 2, maxlength: 5 }, role: { type: String, default: "user", enum: ["user", "admin"] }, password: { type: String, select: false } },
    });
    const posts = ds.register({ name: "Post", schema: { title: { type: String }, author: { type: "ObjectId", ref: "User" } } as never });
    return { ds, users, posts };
  };

  it("applies defaults, lowercase and trim, timestamps and a string id", async () => {
    const { users } = make();
    const u = await users.create({ email: "  A@B.CO ", name: "Ann" });
    expect(u).toMatchObject({ email: "a@b.co", role: "user" });
    expect(u._id).toMatch(/^[0-9a-f]{24}$/);
    expect(u.createdAt).toBeInstanceOf(Date);
  });

  it("enforces required, length and enum like Mongoose validation errors", async () => {
    const { users } = make();
    await expect(users.create({})).rejects.toMatchObject({ name: "ValidationError", errors: { email: { kind: "required" } } });
    await expect(users.create({ email: "a@b.co", name: "A" })).rejects.toMatchObject({ errors: { name: { kind: "minlength" } } });
    await expect(users.create({ email: "a@b.co", name: "Annabelle" })).rejects.toMatchObject({ errors: { name: { kind: "maxlength" } } });
    await expect(users.create({ email: "a@b.co", role: "root" })).rejects.toMatchObject({ errors: { role: { kind: "enum" } } });
  });

  it("throws an E11000-shaped error on unique violations (create and update)", async () => {
    const { users } = make();
    await users.create({ email: "a@b.co" });
    await expect(users.create({ email: "A@b.co" })).rejects.toMatchObject({ code: 11000, keyPattern: { email: 1 } });
    const other = await users.create({ email: "c@d.co" });
    await expect(users.updateById(other._id, { email: "a@b.co" })).rejects.toMatchObject({ code: 11000 });
    await expect(users.updateById(other._id, { email: "c@d.co" })).resolves.toBeTruthy();
  });

  it("createMany behaves like an ordered insertMany: validates all first, then stops at a unique violation", async () => {
    const { users } = make();
    await expect(users.createMany([{ email: "a@b.co" }, {}])).rejects.toMatchObject({ name: "ValidationError" });
    expect(await users.find({})).toHaveLength(0);

    await expect(users.createMany([{ email: "a@b.co" }, { email: "c@d.co" }, { email: "A@b.co" }])).rejects.toMatchObject({
      name: "MongoBulkWriteError",
      code: 11000,
    });
    expect((await users.find({})).map((u) => u.email)).toEqual(["a@b.co", "c@d.co"]);
  });

  it("hides select:false fields unless asked, but returns them from create", async () => {
    const { users } = make();
    const created = await users.create({ email: "a@b.co", password: "secret123" });
    expect(created.password).toBe("secret123");
    expect((await users.findById(created._id))!.password).toBeUndefined();
    expect((await users.findById(created._id, { withSecrets: ["password"] }))!.password).toBe("secret123");
    expect((await users.find({}))[0]!.password).toBeUndefined();
  });

  it("filters by equality and $in, sorts, skips and limits", async () => {
    const { users } = make();
    const made = [];
    for (const e of ["c", "a", "b", "d"]) made.push(await users.create({ email: `${e}@x.co`, name: e.repeat(2) }));
    expect(await users.count({})).toBe(4);
    expect((await users.find({ _id: { $in: [made[0]!._id, made[1]!._id] } })).map((u) => u.email).sort()).toEqual(["a@x.co", "c@x.co"]);
    expect((await users.find({}, { sort: { email: 1 }, skip: 1, limit: 2 })).map((u) => u.email)).toEqual(["b@x.co", "c@x.co"]);
    expect((await users.find({}, { sort: { email: -1 }, limit: 1 }))[0]!.email).toBe("d@x.co");
    expect(await users.findOne({ email: "nope@x.co" })).toBeNull();
  });

  it("updates, bulk-updates and deletes, returning null for missing documents", async () => {
    const { users } = make();
    const a = await users.create({ email: "a@x.co" });
    await users.create({ email: "b@x.co" });
    expect((await users.updateById(a._id, { name: "Zed" }))!.name).toBe("Zed");
    expect(await users.updateById("f".repeat(24), { name: "x" })).toBeNull();
    expect(await users.updateMany({ role: "user" }, { role: "admin" })).toBe(2);
    expect(await users.deleteById("f".repeat(24))).toBeNull();
    expect((await users.deleteById(a._id))!.email).toBe("a@x.co");
    expect(await users.deleteMany({})).toBe(1);
  });

  it("populates references with only the requested fields (and null for dangling refs)", async () => {
    const { users, posts } = make();
    const author = await users.create({ email: "a@x.co", name: "Ann" });
    const post = await posts.create({ title: "t", author: author._id });
    const populated = (await posts.findById(post._id, { populate: { path: "author", select: "name" } }))!;
    expect(populated.author).toEqual({ _id: author._id, name: "Ann" });

    await users.deleteById(author._id);
    expect((await posts.findById(post._id, { populate: { path: "author", select: "name" } }))!.author).toBeNull();
  });

  it("populates several paths and arrays of references, like Mongoose does", async () => {
    const { ds, users } = make();
    const teams = ds.register({
      name: "Team",
      schema: { name: { type: String }, lead: { type: "ObjectId", ref: "User" }, members: [{ type: "ObjectId", ref: "User" }] } as never,
    });
    const ann = await users.create({ email: "a@x.co", name: "Ann" });
    const bob = await users.create({ email: "b@x.co", name: "Bob" });
    const team = await teams.create({ name: "Core", lead: ann._id, members: [bob._id, "f".repeat(24), ann._id] });

    const found = (await teams.findById(team._id, { populate: { path: "lead members", select: "name" } }))!;
    expect(found.lead).toEqual({ _id: ann._id, name: "Ann" });
    // A member that no longer exists is left out of the array instead of becoming null.
    expect(found.members).toEqual([{ _id: bob._id, name: "Bob" }, { _id: ann._id, name: "Ann" }]);
    expect(found.name).toBe("Core");
  });

  it("returns copies, so callers cannot corrupt stored data", async () => {
    const { users } = make();
    const u = await users.create({ email: "a@x.co" });
    u.email = "hacked@x.co";
    expect((await users.findById(u._id))!.email).toBe("a@x.co");
  });

  it("throws for unknown models and supports an outage switch", async () => {
    const { ds } = make();
    expect(() => ds.repository("Nope")).toThrow(/not registered/);
    expect(await ds.ping()).toBe(true);
    ds.healthy = false;
    expect(await ds.ping()).toBe(false);
  });
});
