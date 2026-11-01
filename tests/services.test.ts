import { describe, expect, it, vi } from "vitest";
import { ForgeConfig } from "../src/config/ForgeConfig.js";
import { ActionRunner } from "../src/core/ActionRunner.js";
import { AccessPolicy } from "../src/core/AccessPolicy.js";
import { FieldTransformer, parseFieldSpec } from "../src/core/FieldTransformer.js";
import { Pagination } from "../src/core/Pagination.js";
import { ResponseSanitizer } from "../src/core/ResponseSanitizer.js";
import { Authenticator } from "../src/http/Authenticator.js";
import { CryptoVault, generateMasterKey } from "../src/security/CryptoVault.js";
import { PasswordHasher } from "../src/security/PasswordHasher.js";
import { TokenService } from "../src/security/TokenService.js";
import { InMemoryDataSource } from "../src/testing/index.js";
import { Logger } from "../src/utils/Logger.js";
import { ResponseWriter } from "../src/http/ResponseWriter.js";

const id = (c: string) => c.repeat(24);

describe("ResponseSanitizer", () => {
  const sanitizer = new ResponseSanitizer();
  const doc = { _id: id("a"), name: "n", password: "p", tokenHash: "h", codeHash: "c", resetTokenHash: "r", __v: 0, nested: { password: "deep", keep: 1 }, list: [{ password: "x", ok: true }] };

  it("always removes secrets, at any depth", () => {
    const out = sanitizer.one(doc as never);
    expect(out).toEqual({ _id: id("a"), name: "n", nested: { keep: 1 }, list: [{ ok: true }] });
  });

  it("cannot be talked into returning a password with '!password'", () => {
    expect(sanitizer.one(doc as never, { hiddenFields: ["!password", "!tokenHash"] })).not.toHaveProperty("password");
  });

  it("hides configured fields and lets '!__v' opt back in", () => {
    expect(sanitizer.one(doc as never, { hiddenFields: ["name", "_id"] })).not.toHaveProperty("name");
    expect(sanitizer.one(doc as never, { hiddenFields: ["!__v"] })).toHaveProperty("__v", 0);
    expect(sanitizer.one(doc as never)).not.toHaveProperty("__v");
  });

  it("hides sealed values unless they were decrypted for this response", () => {
    const sealed = { str: "a", nonce: "b", publicKey: "c", securedPrivateKey: "d" };
    expect(sanitizer.one({ _id: id("a"), secret: sealed } as never)).not.toHaveProperty("secret");
    expect(sanitizer.one({ _id: id("a"), secret: sealed } as never, { decrypted: ["secret"] })).toHaveProperty("secret");
  });

  it("drops sealed values inside nested objects, such as a populated document", () => {
    const sealed = { str: "a", nonce: "b", publicKey: "c", securedPrivateKey: "d" };
    const input = { _id: id("a"), note: { _id: id("b"), title: "t", secret: sealed }, list: [{ secret: sealed, ok: 1 }, sealed] };
    expect(sanitizer.one(input as never)).toEqual({ _id: id("a"), note: { _id: id("b"), title: "t" }, list: [{ ok: 1 }] });
  });

  it("drops password-hash-shaped strings and registered secret fields", () => {
    const s = new ResponseSanitizer(["apiKey"]);
    s.addSecrets(["pin"]);
    expect(s.one({ _id: id("a"), apiKey: "k", pin: "1", blob: "$argon2id$v=19$x", fine: "ok" } as never)).toEqual({ _id: id("a"), fine: "ok" });
  });

  it("does not mutate its input and keeps dates and buffers intact", () => {
    const when = new Date();
    const input = { _id: id("a"), password: "p", when, raw: Buffer.from("x") };
    const out = sanitizer.one(input as never);
    expect(input.password).toBe("p");
    expect(out.when).toBe(when);
    expect(Buffer.isBuffer(out.raw)).toBe(true);
  });

  it("handles lists", () => {
    expect(sanitizer.many([{ _id: id("a"), password: "x" }, { _id: id("b") }] as never)).toEqual([{ _id: id("a") }, { _id: id("b") }]);
  });
});

describe("FieldTransformer", () => {
  const make = async () => new FieldTransformer(new CryptoVault(await generateMasterKey()), new PasswordHasher());

  it("parses optional markers", () => {
    expect(parseFieldSpec("a?")).toEqual({ name: "a", optional: true });
    expect(parseFieldSpec("a")).toEqual({ name: "a", optional: false });
  });

  it("encrypts and decrypts listed fields without touching the input", async () => {
    const tf = await make();
    const body = { a: "plain", b: "keep" };
    const enc = await tf.encrypt(body, ["a"]);
    expect(enc.b).toBe("keep");
    expect(enc.a).toHaveProperty("securedPrivateKey");
    expect(body.a).toBe("plain");
    expect(await tf.decrypt(enc, ["a"])).toEqual({ a: "plain" });
  });

  it("skips absent optional fields and rejects absent required ones", async () => {
    const tf = await make();
    expect(await tf.encrypt({}, ["a?"])).toEqual({});
    await expect(tf.encrypt({}, ["a"])).rejects.toMatchObject({ code: "FIELD_MISSING" });
    await expect(tf.encrypt({ a: undefined }, ["a"])).rejects.toMatchObject({ code: "FIELD_MISSING" });
    await expect(tf.decrypt({}, ["a"])).rejects.toMatchObject({ code: "FIELD_MISSING" });
    expect(await tf.decrypt({}, ["a?"])).toEqual({});
  });

  it("only transforms strings", async () => {
    const tf = await make();
    await expect(tf.encrypt({ a: { $ne: 1 } }, ["a"])).rejects.toMatchObject({ statusCode: 422 });
    await expect(tf.hash({ a: 5 }, ["a"])).rejects.toMatchObject({ statusCode: 422 });
  });

  it("hashes fields with Argon2id", async () => {
    const tf = await make();
    const out = await tf.hash({ pin: "1234" }, ["pin"]);
    expect(out.pin).toMatch(/^\$argon2id\$/);
  });

  it("leaves non-sealed stored values alone when decrypting", async () => {
    const tf = await make();
    expect(await tf.decrypt({ a: "legacy plaintext" }, ["a"])).toEqual({});
  });
});

describe("Pagination", () => {
  const pagination = new Pagination(new ForgeConfig({ ENV: "test", defaultPageSize: 10, maxPageSize: 25 }));
  const req = (query: Record<string, unknown>) => ({ query }) as never;

  it("applies defaults", () => {
    expect(pagination.parse(req({}), [])).toEqual({ page: 1, limit: 10, skip: 0, sort: { createdAt: -1, _id: -1 } });
  });

  it("computes skip and clamps the limit", () => {
    expect(pagination.parse(req({ page: "3", limit: "999" }), [])).toMatchObject({ page: 3, limit: 25, skip: 50 });
  });

  it("accepts whitelisted sorts, multiple keys and directions", () => {
    expect(pagination.parse(req({ sort: "-price,name" }), ["price", "name"]).sort).toEqual({ price: -1, name: 1 });
    expect(pagination.parse(req({ sort: "+name" }), ["name"]).sort).toEqual({ name: 1 });
  });

  it.each([{ sort: "secret" }, { sort: ["a", "b"] }, { sort: "a$" }, { page: "0" }, { page: ["1"] }, { limit: "2e3" }])("rejects %j", (query) => {
    expect(() => pagination.parse(req(query), ["a"])).toThrow();
  });

  it("limits the number of sort keys", () => {
    const keys = ["a", "b", "c", "d", "e", "f", "g"];
    expect(Object.keys(pagination.parse(req({ sort: keys.join(",") }), keys).sort)).toHaveLength(5);
  });

  it("builds page metadata", () => {
    const page = pagination.parse(req({ limit: "10" }), []);
    expect(pagination.meta(page, 95)).toEqual({ page: 1, limit: 10, total: 95, pages: 10 });
    expect(pagination.meta(page, 0).pages).toBe(1);
  });
});

describe("AccessPolicy", () => {
  const config = new ForgeConfig({ ENV: "test", adminRoles: ["admin", "root"], protectedFields: ["role", "verified"] });
  const tokens = new TokenService("s".repeat(40));
  const policy = new AccessPolicy(config, new Authenticator(config, tokens, new InMemoryDataSource()));
  const admin = { _id: id("1"), role: "root" };
  const alice = { _id: id("2"), role: "user" };
  const doc = { _id: id("9"), owner: alice._id };

  it("knows administrators from the configured roles", () => {
    expect(policy.isAdmin(admin)).toBe(true);
    expect(policy.isAdmin(alice)).toBe(false);
    expect(policy.isAdmin({ _id: "x", role: undefined })).toBe(false);
    expect(policy.isAdmin(undefined)).toBe(false);
  });

  it("checks ownership by owner field or by self", () => {
    expect(() => policy.assertCanAccess({ auth: "admin-or-owner" } as never, alice, doc)).not.toThrow();
    expect(() => policy.assertCanAccess({ auth: "admin-or-owner" } as never, { _id: id("3") }, doc)).toThrow(/own data/);
    expect(() => policy.assertCanAccess({ auth: "admin-or-owner" } as never, admin, doc)).not.toThrow();
    expect(() => policy.assertCanAccess({ auth: "admin-or-owner", ownership: "self" } as never, { _id: doc._id }, doc)).not.toThrow();
    expect(() => policy.assertCanAccess({ auth: "admin-or-owner" } as never, undefined, doc)).toThrow();
    expect(() => policy.assertCanAccess({ auth: "authenticated" } as never, { _id: id("3") }, doc)).not.toThrow();
  });

  it("recognises a populated owner object", () => {
    expect(() => policy.assertCanAccess({ auth: "admin-or-owner" } as never, alice, { _id: id("9"), owner: { _id: alice._id } })).not.toThrow();
  });

  it("builds database filters for lists", () => {
    expect(policy.scopeFilter({ auth: "admin-or-owner" } as never, alice)).toEqual({ owner: alice._id });
    expect(policy.scopeFilter({ auth: "admin-or-owner", ownership: "self" } as never, alice)).toEqual({ _id: alice._id });
    expect(policy.scopeFilter({ auth: "admin-or-owner" } as never, admin)).toEqual({});
    expect(policy.scopeFilter({ auth: "public" } as never, undefined)).toEqual({});
    expect(() => policy.scopeFilter({ auth: "admin-or-owner" } as never, undefined)).toThrow();
  });

  it("strips protected fields for everyone but admins", () => {
    const body = { name: "n", role: "admin", verified: true };
    expect(policy.writableBody(body, alice)).toEqual({ name: "n" });
    expect(policy.writableBody(body, undefined)).toEqual({ name: "n" });
    expect(policy.writableBody(body, admin)).toEqual(body);
    expect(body.role).toBe("admin");
  });

  it("stamps the owner", () => {
    expect(policy.ownerStamp(alice)).toEqual({ owner: alice._id });
    expect(policy.ownerStamp(undefined)).toEqual({});
  });

  it("uses the configured owner field for checks, filters, stamping, and writable bodies", () => {
    const customConfig = new ForgeConfig({
      ENV: "test",
      protectedFields: ["role"],
      builtinConfig: { auth: { mode: "manual", ownerField: "createdBy" } },
    });
    const customPolicy = new AccessPolicy(customConfig, new Authenticator(customConfig, tokens, new InMemoryDataSource()));
    const customDoc = { _id: id("9"), createdBy: alice._id };

    expect(customPolicy.ownerOf(customDoc, { auth: "admin-or-owner" } as never)).toBe(alice._id);
    expect(() => customPolicy.assertCanAccess({ auth: "admin-or-owner" } as never, alice, customDoc)).not.toThrow();
    expect(customPolicy.scopeFilter({ auth: "admin-or-owner" } as never, alice)).toEqual({ createdBy: alice._id });
    expect(customPolicy.ownerStamp(alice)).toEqual({ createdBy: alice._id });
    expect(customPolicy.writableBody({ createdBy: id("3"), owner: id("4"), name: "n" }, alice)).toEqual({ owner: id("4"), name: "n" });
  });
});

describe("ActionRunner", () => {
  const emails = { sendAction: vi.fn(async () => {}) };
  const runner = () => new ActionRunner(emails as never, Logger.silent());

  it("runs 'before' actions in order and propagates errors", async () => {
    const order: number[] = [];
    await runner().runBefore([{ customAction: () => void order.push(1) }, { customAction: async () => void order.push(2) }], {} as never);
    expect(order).toEqual([1, 2]);
    await expect(runner().runBefore([{ customAction: () => { throw new Error("stop"); } }], {} as never)).rejects.toThrow("stop");
  });

  it("'after' actions chain replacements and swallow failures", async () => {
    const seen: unknown[] = [];
    const result = await runner().runAfter(
      [
        { customAction: (c) => { seen.push(structuredClone(c.result)); return { step: 1 }; } },
        { customAction: () => { throw new Error("ignored"); } },
        { customAction: (c) => { seen.push(structuredClone(c.result)); return undefined; } },
      ],
      { result: { message: "ok", data: "orig" } } as never,
    );
    expect(result).toEqual({ step: 1 });
    expect(seen).toEqual([
      { message: "ok", data: "orig" },
      { message: "ok", data: { step: 1 } },
    ]);
  });

  it("returns undefined when no action replaces the result", async () => {
    expect(await runner().runAfter(undefined, {} as never)).toBeUndefined();
    expect(await runner().runAfter([{ customAction: () => undefined }], {} as never)).toBeUndefined();
  });

  it("dispatches e-mail actions to the e-mail service", async () => {
    const action = { emailAction: { from: "f", to: "t", type: "raw", subject: "s", rawBody: "b" } } as never;
    await runner().runBefore([action], { a: 1 } as never);
    expect(emails.sendAction).toHaveBeenCalledWith((action as any).emailAction, { a: 1 });
  });

  it("validates action shapes up front", () => {
    expect(() => runner().assertValid([{ customAction: () => {} }, { emailAction: {} as never }], "x")).not.toThrow();
    expect(() => runner().assertValid([{ foo: 1 } as never], "x")).toThrow(/customAction/);
    expect(() => runner().assertValid([{ customAction: "nope" } as never], "x")).toThrow();
    expect(() => runner().assertValid(undefined, "x")).not.toThrow();
  });
});

describe("ResponseWriter", () => {
  it("writes success and created bodies", () => {
    const calls: Array<[number, unknown]> = [];
    const res = { status(code: number) { return { json: (b: unknown) => calls.push([code, b]) }; } } as never;
    const writer = new ResponseWriter();
    writer.success(res, { message: "ok", data: { a: 1 }, meta: { page: 1, limit: 1, total: 1, pages: 1 }, extra: { token: "t" } });
    writer.created(res, { message: "made" });
    expect(calls[0]).toEqual([200, { success: true, message: "ok", data: { a: 1 }, meta: { page: 1, limit: 1, total: 1, pages: 1 }, token: "t" }]);
    expect(calls[1]).toEqual([201, { success: true, message: "made" }]);
  });
});
