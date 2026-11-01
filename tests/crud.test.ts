import { z } from "zod";
import { afterEach, describe, expect, it } from "vitest";
import { collection, fields, ForbiddenError, ValidationError, type Collection } from "../src/index.js";
import type { TestForge } from "../src/testing/index.js";
import { authForge, makeAdmin, signup } from "./helpers.js";

let t: TestForge;
afterEach(() => t?.close());

const noteSchema = { title: fields.requiredString, body: { type: String }, owner: fields.userRef } as never;
const noteRules = { title: z.string().min(1).max(100), body: z.string().max(1000).optional(), owner: z.string().optional() };

const notes = (actions: Record<string, unknown> = {}): Collection =>
  collection({
    type: "crud",
    route: "notes",
    model: "Note",
    schema: noteSchema,
    validations: { create: noteRules, update: { title: noteRules.title.optional(), body: noteRules.body }, bulk: noteRules },
    routes: [
      { method: "get", path: "/", handler: "readAll", auth: "admin-or-owner" },
      { method: "get", path: "/:id", handler: "read", auth: "admin-or-owner" },
      { method: "post", path: "/", handler: "create", auth: "authenticated", validation: "create", ...actions },
      { method: "post", path: "/bulk", handler: "createBulk", auth: "authenticated", validation: "bulk", config: { maxBulkSize: 3 } },
      { method: "patch", path: "/update/:id", handler: "update", auth: "admin-or-owner", validation: "update" },
      { method: "delete", path: "/delete/:id", handler: "remove", auth: "admin-or-owner" },
      { method: "post", path: "/delete-many", handler: "removeMultiple", auth: "admin-or-owner", config: { targetField: "ids" } },
      { method: "delete", path: "/", handler: "removeAll", auth: "admin" },
    ],
  });

const boot = (...collections: Collection[]) => authForge({}, { collections });

const user = async (email: string) => {
  const client = t.newClient();
  await signup(client, email);
  return client;
};

describe("ownership and access control", () => {
  it("stamps the owner from the session, ignoring an owner sent in the body", async () => {
    t = await boot(notes());
    const a = await user("a@example.com");
    const b = await user("b@example.com");
    const bUser = (await t.data.repository("User").findOne({ email: "b@example.com" }))!;

    const res = await a.post("/notes", { title: "mine", owner: bUser._id });
    expect(res.status).toBe(201);
    const aUser = (await t.data.repository("User").findOne({ email: "a@example.com" }))!;
    expect(res.body.data.owner).toBe(aUser._id);
    expect(b).toBeDefined();
  });

  it("scopes list endpoints to the caller (1.x checked only the first item and leaked the rest)", async () => {
    t = await boot(notes());
    const a = await user("a@example.com");
    const b = await user("b@example.com");
    await a.post("/notes", { title: "a1" });
    await a.post("/notes", { title: "a2" });
    await b.post("/notes", { title: "b1" });

    const listA = await a.get("/notes");
    expect(listA.status).toBe(200);
    expect(listA.body.data.map((n: any) => n.title).sort()).toEqual(["a1", "a2"]);
    expect(listA.body.meta.total).toBe(2);

    const listB = await b.get("/notes");
    expect(listB.body.data.map((n: any) => n.title)).toEqual(["b1"]);
  });

  it("lets administrators see everything", async () => {
    t = await boot(notes());
    const a = await user("a@example.com");
    await a.post("/notes", { title: "a1" });
    const admin = await makeAdmin(t);
    await admin.post("/notes", { title: "admin-note" });
    const all = await admin.get("/notes");
    expect(all.body.meta.total).toBe(2);
  });

  it("denies reading, updating and deleting someone else's document with 403 OWNER_REQUIRED", async () => {
    t = await boot(notes());
    const a = await user("a@example.com");
    const b = await user("b@example.com");
    const id = (await a.post("/notes", { title: "private" })).body.data._id;

    for (const res of [
      await b.get(`/notes/${id}`),
      await b.patch(`/notes/update/${id}`, { title: "hacked" }),
      await b.delete(`/notes/delete/${id}`),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("OWNER_REQUIRED");
    }
    expect((await a.get(`/notes/${id}`)).body.data.title).toBe("private");
  });

  it("does not let a non-admin hand a document to another user through update, but lets an administrator", async () => {
    t = await boot(
      collection({
        type: "crud", route: "tickets", model: "Ticket",
        schema: { title: fields.requiredString, owner: fields.userRef } as never,
        validations: { create: { title: z.string() }, update: { title: z.string().optional(), owner: z.string().optional() } },
        routes: [
          { method: "post", path: "/", handler: "create", auth: "authenticated", validation: "create" },
          { method: "patch", path: "/update/:id", handler: "update", auth: "admin-or-owner", validation: "update" },
        ],
      }),
    );
    const a = await user("a@example.com");
    await user("b@example.com");
    const aUser = (await t.data.repository("User").findOne({ email: "a@example.com" }))!;
    const bUser = (await t.data.repository("User").findOne({ email: "b@example.com" }))!;
    const id = (await a.post("/tickets", { title: "mine" })).body.data._id;

    const attempt = await a.patch(`/tickets/update/${id}`, { title: "renamed", owner: bUser._id });
    expect(attempt.status).toBe(200);
    expect(attempt.body.data.title).toBe("renamed");
    expect(attempt.body.data.owner).toBe(aUser._id);

    const admin = await makeAdmin(t);
    const moved = await admin.patch(`/tickets/update/${id}`, { owner: bUser._id });
    expect(moved.body.data.owner).toBe(bUser._id);
  });

  it("allows the owner and administrators", async () => {
    t = await boot(notes());
    const a = await user("a@example.com");
    const admin = await makeAdmin(t);
    const id = (await a.post("/notes", { title: "v1" })).body.data._id;

    expect((await a.patch(`/notes/update/${id}`, { title: "v2" })).body.data.title).toBe("v2");
    expect((await admin.patch(`/notes/update/${id}`, { title: "v3" })).status).toBe(200);
    expect((await admin.delete(`/notes/delete/${id}`)).status).toBe(200);
    expect((await a.get(`/notes/${id}`)).status).toBe(404);
  });

  it("requires authentication on protected routes", async () => {
    t = await boot(notes());
    expect((await t.client.get("/notes")).status).toBe(401);
    expect((await t.client.post("/notes", { title: "x" })).status).toBe(401);
  });

  it("restricts removeAll to administrators and deletes everything for them", async () => {
    t = await boot(notes());
    const a = await user("a@example.com");
    await a.post("/notes", { title: "a1" });
    expect((await a.delete("/notes")).status).toBe(403);

    const admin = await makeAdmin(t);
    const res = await admin.delete("/notes");
    expect(res.body.data).toEqual({ deleted: 1 });
    expect(t.data.repository("Note").dump()).toHaveLength(0);
  });

  it("removeMultiple only deletes the caller's own documents", async () => {
    t = await boot(notes());
    const a = await user("a@example.com");
    const b = await user("b@example.com");
    const mine = (await a.post("/notes", { title: "mine" })).body.data._id;
    const theirs = (await b.post("/notes", { title: "theirs" })).body.data._id;

    const res = await a.post("/notes/delete-many", { ids: [mine, theirs] });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ deleted: 1 });
    expect(t.data.repository("Note").dump().map((n) => n.title)).toEqual(["theirs"]);
  });

  it.each([
    ["not an array", { ids: "abc" }],
    ["empty", { ids: [] }],
    ["invalid id", { ids: ["not-an-id"] }],
    ["operator object", { ids: [{ $ne: null }] }],
    ["too many", { ids: Array.from({ length: 101 }, () => "a".repeat(24)) }],
  ])("removeMultiple rejects %s", async (_label, body) => {
    t = await boot(notes());
    const a = await user("a@example.com");
    const res = await a.post("/notes/delete-many", body);
    expect(res.status).toBe(400);
  });
});

describe("single-document handlers", () => {
  it("returns 400 for a malformed id and 404 for an unknown one", async () => {
    t = await boot(notes());
    const a = await user("a@example.com");
    const bad = await a.get("/notes/not-an-id");
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe("INVALID_OBJECT_ID");
    const missing = await a.get(`/notes/${"a".repeat(24)}`);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("returns 404 when updating or deleting something that does not exist", async () => {
    t = await boot(notes());
    const admin = await makeAdmin(t);
    expect((await admin.patch(`/notes/update/${"b".repeat(24)}`, { title: "x" })).status).toBe(404);
    expect((await admin.delete(`/notes/delete/${"b".repeat(24)}`)).status).toBe(404);
  });

  it("strips unknown and dangerous fields before saving", async () => {
    t = await boot(notes());
    const a = await user("a@example.com");
    const res = await a.post("/notes", JSON.parse('{"title":"t","isAdmin":true,"__proto__":{"x":1},"$set":{"a":1}}'));
    expect(res.status).toBe(201);
    const [row] = t.data.repository("Note").dump();
    expect(row).not.toHaveProperty("isAdmin");
    expect(row).not.toHaveProperty("$set");
  });

  it("validates bodies: 422 with issues", async () => {
    t = await boot(notes());
    const a = await user("a@example.com");
    const res = await a.post("/notes", { title: "" });
    expect(res.status).toBe(422);
    expect(res.body.issues[0].path).toBe("title");
  });

  it("returns 422 when a required model field is missing even if validation allows it", async () => {
    t = await boot(
      collection({
        type: "crud", route: "loose", model: "Loose", schema: { title: fields.requiredString },
        validations: { any: { title: z.string().optional() } },
        routes: [{ method: "post", path: "/", handler: "create", auth: "public", validation: "any" }],
      }),
    );
    const res = await t.client.post("/loose", {});
    expect(res.status).toBe(422);
    expect(res.body.issues[0].code).toBe("required");
  });

  it("maps unique-index violations to 409 DUPLICATE_KEY", async () => {
    t = await boot(
      collection({
        type: "crud", route: "tags", model: "Tag", schema: { name: { type: String, unique: true, required: true } as never },
        validations: { create: { name: z.string() } },
        routes: [{ method: "post", path: "/", handler: "create", auth: "public", validation: "create" }],
      }),
    );
    await t.client.post("/tags", { name: "x" });
    const dup = await t.client.post("/tags", { name: "x" });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe("DUPLICATE_KEY");
    expect(dup.body.message).toContain("name");
  });
});

describe("bulk create", () => {
  it("creates many, stamping the owner on each", async () => {
    t = await boot(notes());
    const a = await user("a@example.com");
    const res = await a.post("/notes/bulk", [{ title: "1" }, { title: "2" }]);
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(2);
    expect(new Set(res.body.data.map((n: any) => n.owner)).size).toBe(1);
  });

  it("validates every element and creates nothing if one is bad", async () => {
    t = await boot(notes());
    const a = await user("a@example.com");
    const res = await a.post("/notes/bulk", [{ title: "ok" }, { title: "" }]);
    expect(res.status).toBe(422);
    expect(t.data.repository("Note").dump()).toHaveLength(0);
  });

  it("reports every bad item with its position, and creates nothing", async () => {
    t = await boot(notes());
    const a = await user("a@example.com");
    const res = await a.post("/notes/bulk", [{ title: "ok" }, { title: "" }, { title: "" }]);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_FAILED");
    expect(res.body.issues.map((issue: { path: string }) => issue.path)).toEqual(["1.title", "2.title"]);
    expect(res.body.message).toMatch(/^1\.title: /);
    expect(t.data.repository("Note").dump()).toHaveLength(0);
  });

  it.each([["an object", { title: "x" }], ["an empty array", []], ["too many items", [1, 2, 3, 4].map((i) => ({ title: `n${i}` }))]])(
    "rejects %s with 400",
    async (_l, body) => {
      t = await boot(notes());
      const a = await user("a@example.com");
      expect((await a.post("/notes/bulk", body)).status).toBe(400);
    },
  );

  it("answers 409 for a duplicate in the request and keeps the items inserted before it (no transaction)", async () => {
    t = await boot(
      collection({
        type: "crud", route: "tags", model: "Tag", schema: { name: { type: String, unique: true, required: true } as never },
        validations: { create: { name: z.string() } },
        routes: [{ method: "post", path: "/bulk", handler: "createBulk", auth: "public", validation: "create" }],
      }),
    );
    const res = await t.client.post("/tags/bulk", [{ name: "a" }, { name: "b" }, { name: "a" }, { name: "c" }]);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DUPLICATE_KEY");
    expect(res.body.message).toBe("An item with this name already exists.");
    // MongoDB's ordered insert stops at the failure and keeps what it already inserted.
    expect(t.data.repository("Tag").dump().map((tag: any) => tag.name)).toEqual(["a", "b"]);
  });
});

describe("pagination and sorting", () => {
  const seed = async () => {
    const admin = await makeAdmin(t);
    for (const title of ["c", "a", "e", "b", "d"]) await admin.post("/notes", { title });
    return admin;
  };

  it("paginates with meta", async () => {
    t = await boot(notes());
    const admin = await seed();
    const page2 = await admin.get("/notes?limit=2&page=2&sort=title");
    expect(page2.body.data.map((n: any) => n.title)).toEqual(["c", "d"]);
    expect(page2.body.meta).toEqual({ page: 2, limit: 2, total: 5, pages: 3 });
  });

  it("sorts descending with a minus sign", async () => {
    t = await boot(notes());
    const admin = await seed();
    const res = await admin.get("/notes?sort=-title");
    expect(res.body.data.map((n: any) => n.title)).toEqual(["e", "d", "c", "b", "a"]);
  });

  it("returns an empty list (200), not 404, for an empty collection", async () => {
    t = await boot(notes());
    const admin = await makeAdmin(t);
    const res = await admin.get("/notes");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it("caps the page size at maxPageSize", async () => {
    t = await authForge({}, { collections: [notes()], maxPageSize: 3, defaultPageSize: 2 });
    const admin = await seed();
    expect((await admin.get("/notes?limit=1000")).body.meta.limit).toBe(3);
    expect((await admin.get("/notes")).body.meta.limit).toBe(2);
  });

  it("ignores bracket-style operator parameters instead of passing them to the database", async () => {
    t = await boot(notes());
    const admin = await makeAdmin(t);
    const res = await admin.get("/notes?limit[$gt]=1&sort[$ne]=x");
    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(50);
  });

  it.each(["limit=0", "limit=-1", "limit=abc", "limit=1.5", "page=0", "page=x"])("rejects %s", async (query) => {
    t = await boot(notes());
    const admin = await makeAdmin(t);
    expect((await admin.get(`/notes?${query}`)).status).toBe(400);
  });

  it.each(["password", "$where", "title,__proto__", "owner.password", "title;drop"])("refuses to sort by %s", async (sort) => {
    t = await boot(notes());
    const admin = await makeAdmin(t);
    const res = await admin.get(`/notes?sort=${encodeURIComponent(sort)}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_QUERY");
  });

  it("refuses to sort by a field the route hides (the order would leak the hidden values)", async () => {
    t = await boot(
      collection({
        type: "crud", route: "goods", model: "Good",
        schema: { name: fields.requiredString, cost: fields.requiredNumber } as never,
        validations: { create: { name: z.string(), cost: z.number() } },
        routes: [
          { method: "post", path: "/", handler: "create", auth: "public", validation: "create" },
          { method: "get", path: "/", handler: "readAll", auth: "public", config: { hiddenFields: ["cost"] } },
        ],
      }),
    );
    await t.client.post("/goods", { name: "cheap", cost: 1 });
    await t.client.post("/goods", { name: "dear", cost: 99 });

    const list = await t.client.get("/goods?sort=name");
    expect(list.status).toBe(200);
    expect(list.body.data.map((g: any) => g.name)).toEqual(["cheap", "dear"]);
    expect(list.body.data[0].cost).toBeUndefined();

    const res = await t.client.get("/goods?sort=-cost");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_QUERY");
    expect(res.body.hint).not.toContain("cost");
  });
});

describe("population", () => {
  const products = (config: Record<string, unknown>): Collection =>
    collection({
      type: "crud", route: "products", model: "Product",
      schema: { name: fields.requiredString, owner: fields.userRef } as never,
      validations: { create: { name: z.string() } },
      routes: [
        { method: "post", path: "/", handler: "create", auth: "authenticated", validation: "create" },
        { method: "get", path: "/", handler: "readAll", auth: "public", config },
      ],
    });

  it("only exposes the referenced _id by default (1.x leaked owner e-mails to anyone)", async () => {
    t = await boot(products({ populate: "owner" }));
    const a = await user("a@example.com");
    await a.post("/products", { name: "p" });
    const res = await t.client.get("/products");
    const [owner] = res.body.data.map((p: any) => p.owner);
    expect(Object.keys(owner)).toEqual(["_id"]);
    expect(JSON.stringify(res.body)).not.toContain("a@example.com");
  });

  it("returns more fields only when populateSelect asks for them", async () => {
    t = await boot(products({ populate: "owner", populateSelect: "_id name" }));
    const a = await user("a@example.com");
    await a.post("/products", { name: "p" });
    const res = await t.client.get("/products");
    expect(res.body.data[0].owner).toMatchObject({ name: "Ada" });
    expect(res.body.data[0].owner.email).toBeUndefined();
    expect(res.body.data[0].owner.password).toBeUndefined();
  });
});

describe("references between collections", () => {
  const catalog = collection({
    type: "crud", route: "products", model: "Product",
    schema: { name: fields.requiredString, price: fields.requiredNumber, secret: fields.encryptedString } as never,
    validations: { create: { name: z.string(), price: z.number() } },
    routes: [{ method: "post", path: "/", handler: "create", auth: "public", validation: "create" }],
  });

  const orders = (config: Record<string, unknown>): Collection =>
    collection({
      type: "crud", route: "orders", model: "Order",
      schema: {
        quantity: fields.optionalNumber,
        owner: fields.userRef,
        product: { mongoose: { type: "ObjectId", ref: "Product" }, zod: fields.objectId.zod },
        watchers: fields.userRefArray,
      } as never,
      validations: { create: { quantity: z.number(), product: fields.objectId, watchers: fields.userRefArray } },
      routes: [
        { method: "post", path: "/", handler: "create", auth: "authenticated", validation: "create", config },
        { method: "patch", path: "/update/:id", handler: "update", auth: "admin-or-owner", validation: "create", config },
        { method: "get", path: "/", handler: "readAll", auth: "admin-or-owner", config },
        { method: "get", path: "/:id", handler: "read", auth: "admin-or-owner", config },
      ],
    });

  const idOf = async (email: string) => (await t.data.repository("User").findOne({ email }))!._id;

  it("populates several fields of one route, with the same populateSelect for each", async () => {
    t = await boot(catalog, orders({ populate: "owner product", populateSelect: "_id name" }));
    const ann = await user("ann@example.com");
    const product = (await t.client.post("/products", { name: "Keyboard", price: 25 })).body.data;
    const created = await ann.post("/orders", { quantity: 2, product: product._id });

    const one = await ann.get(`/orders/${created.body.data._id}`);
    expect(one.body.data.product).toEqual({ _id: product._id, name: "Keyboard" });
    expect(one.body.data.owner).toEqual({ _id: await idOf("ann@example.com"), name: "Ada" });

    const list = await ann.get("/orders");
    expect(list.body.data[0].product).toEqual({ _id: product._id, name: "Keyboard" });
  });

  it("answers null for a reference whose document no longer exists", async () => {
    t = await boot(catalog, orders({ populate: "product" }));
    const ann = await user("ann@example.com");
    const product = (await t.client.post("/products", { name: "Keyboard", price: 25 })).body.data;
    const created = await ann.post("/orders", { quantity: 1, product: product._id });
    await t.data.repository("Product").deleteById(product._id);

    const res = await ann.get(`/orders/${created.body.data._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.product).toBeNull();
  });

  it("does not check that a referenced document exists when the reference is saved", async () => {
    t = await boot(catalog, orders({ populate: "product" }));
    const ann = await user("ann@example.com");
    const res = await ann.post("/orders", { quantity: 1, product: "f".repeat(24) });
    expect(res.status).toBe(201);
    expect(res.body.data.product).toBe("f".repeat(24));
  });

  it("populates an array of references and leaves out the documents that no longer exist", async () => {
    t = await boot(catalog, orders({ populate: "watchers", populateSelect: "_id name" }));
    const ann = await user("ann@example.com");
    await user("bob@example.com");
    const watchers = [await idOf("bob@example.com"), "f".repeat(24), await idOf("ann@example.com")];
    const created = await ann.post("/orders", { quantity: 1, product: "a".repeat(24), watchers });

    const res = await ann.get(`/orders/${created.body.data._id}`);
    expect(res.body.data.watchers).toEqual([
      { _id: watchers[0], name: "Ada" },
      { _id: watchers[2], name: "Ada" },
    ]);
  });

  it("returns populated documents only from read and readAll", async () => {
    t = await boot(catalog, orders({ populate: "owner product", populateSelect: "_id name" }));
    const ann = await user("ann@example.com");
    const product = (await t.client.post("/products", { name: "Keyboard", price: 25 })).body.data;
    const created = await ann.post("/orders", { quantity: 1, product: product._id });
    expect(typeof created.body.data.product).toBe("string");
    expect(typeof created.body.data.owner).toBe("string");

    const updated = await ann.patch(`/orders/update/${created.body.data._id}`, { quantity: 3, product: product._id });
    expect(updated.status).toBe(200);
    expect(typeof updated.body.data.product).toBe("string");
  });

  it("keeps hiddenFields to the document itself, and never shows an encrypted value inside a populated document", async () => {
    t = await boot(catalog, orders({ populate: "product", populateSelect: "_id name secret", hiddenFields: ["name"] }));
    const ann = await user("ann@example.com");
    const product = await t.data.repository("Product").create({ name: "Keyboard", price: 25, secret: { str: "a", nonce: "b", publicKey: "c", securedPrivateKey: "d" } });
    const created = await ann.post("/orders", { quantity: 1, product: product._id });

    const res = await ann.get(`/orders/${created.body.data._id}`);
    expect(res.body.data.product).toEqual({ _id: product._id, name: "Keyboard" });
  });
});

describe("response hygiene", () => {
  it("hides __v and configured hiddenFields, and supports opting __v back in", async () => {
    const make = (hiddenFields: string[]) =>
      collection({
        type: "crud", route: "items", model: "Item", schema: { name: fields.requiredString, internal: { type: String } } as never,
        validations: { c: { name: z.string(), internal: z.string().optional() } },
        routes: [
          { method: "post", path: "/", handler: "create", auth: "public", validation: "c", config: { hiddenFields } },
        ],
      });
    t = await boot(make(["internal"]));
    const hidden = await t.client.post("/items", { name: "n", internal: "secret" });
    expect(hidden.body.data.internal).toBeUndefined();
    expect(hidden.body.data.name).toBe("n");
    await t.close();

    t = await boot(make(["!__v"]));
    const created = await t.client.post("/items", { name: "n" });
    expect(created.status).toBe(201);
  });

  it("can drop the _id", async () => {
    t = await boot(
      collection({
        type: "crud", route: "items", model: "Item", schema: { name: fields.requiredString } as never,
        validations: { c: { name: z.string() } },
        routes: [{ method: "post", path: "/", handler: "create", auth: "public", validation: "c", config: { hiddenFields: ["_id"] } }],
      }),
    );
    expect((await t.client.post("/items", { name: "n" })).body.data._id).toBeUndefined();
  });
});

describe("encrypted and hashed fields", () => {
  const vault = (): Collection =>
    collection({
      type: "crud", route: "vault", model: "Vault",
      schema: { label: fields.requiredString, secret: fields.encryptedString, pin: { type: String } } as never,
      validations: { create: { label: z.string(), secret: z.string().optional(), pin: z.string().optional() }, strict: { label: z.string(), secret: z.string() } },
      routes: [
        { method: "post", path: "/", handler: "create", auth: "public", validation: "create", encryptedFields: ["secret?"], hashedFields: ["pin?"] },
        { method: "post", path: "/strict", handler: "create", auth: "public", validation: "strict", encryptedFields: ["secret"] },
        { method: "get", path: "/", handler: "readAll", auth: "public" },
        { method: "get", path: "/:id", handler: "read", auth: "public", decryptedFields: ["secret?"] },
      ],
    });

  it("encrypts at rest, hashes the pin, and never returns ciphertext", async () => {
    t = await boot(vault());
    const created = await t.client.post("/vault", { label: "l", secret: "top secret", pin: "1234" });
    expect(created.status).toBe(201);
    expect(JSON.stringify(created.body)).not.toContain("top secret");
    expect(created.body.data.secret).toBeUndefined();

    const [stored] = t.data.repository("Vault").dump();
    expect(stored!.secret.str).toBeTypeOf("string");
    expect(JSON.stringify(stored)).not.toContain("top secret");
    expect(stored!.pin).toMatch(/^\$argon2id\$/);
    expect(created.body.data.pin).toBeUndefined();
    expect(JSON.stringify(created.body)).not.toContain("argon2");
  });

  it("never returns a hash from any route of the collection, even one that does not declare it (list/read)", async () => {
    t = await boot(vault());
    const { body } = await t.client.post("/vault", { label: "l", pin: "1234" });
    expect(JSON.stringify(await t.client.get("/vault"))).not.toContain("argon2");
    expect(JSON.stringify((await t.client.get(`/vault/${body.data._id}`)).body)).not.toContain("argon2");
  });

  it("drops anything shaped like a password hash even in an undeclared field", async () => {
    t = await boot(
      collection({
        type: "crud", route: "leaky", model: "Leaky", schema: { label: fields.requiredString, blob: { type: String } } as never,
        validations: { c: { label: z.string(), blob: z.string().optional() } },
        routes: [{ method: "post", path: "/", handler: "create", auth: "public", validation: "c" }],
      }),
    );
    const hash = await t.forge.services.hasher.hash("whatever1");
    const res = await t.client.post("/leaky", { label: "l", blob: hash });
    expect(res.status).toBe(201);
    expect(res.body.data.blob).toBeUndefined();
    expect(res.body.data.label).toBe("l");
  });

  it.each(["secret", "pin"])("does not allow sorting by the encrypted or hashed field '%s' on a list route", async (field) => {
    t = await boot(vault());
    await t.client.post("/vault", { label: "l", secret: "top secret", pin: "1234" });
    const res = await t.client.get(`/vault?sort=${field}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_QUERY");
    expect((await t.client.get("/vault?sort=label")).status).toBe(200);
  });

  it("hides sealed values in lists and decrypts only where the route asks", async () => {
    t = await boot(vault());
    const { body } = await t.client.post("/vault", { label: "l", secret: "top secret" });
    const list = await t.client.get("/vault");
    expect(JSON.stringify(list.body)).not.toContain("securedPrivateKey");
    const one = await t.client.get(`/vault/${body.data._id}`);
    expect(one.body.data.secret).toBe("top secret");
    expect(JSON.stringify(one.body)).not.toContain("securedPrivateKey");
  });

  it.each(["secret", "pin"])("answers 422, not 500, when a client sends an empty string for the encrypted or hashed field '%s'", async (field) => {
    t = await boot(vault());
    const res = await t.client.post("/vault", { label: "l", [field]: "" });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_FAILED");
    expect(res.body.message).toBe(`'${field}' must not be empty.`);
    expect(t.data.repository("Vault").dump()).toHaveLength(0);
  });

  it("never returns a field that the route both hides and decrypts", async () => {
    t = await boot(
      collection({
        type: "crud", route: "v3", model: "V3", schema: { label: fields.requiredString, secret: fields.encryptedString } as never,
        validations: { c: { label: z.string(), secret: z.string().optional() } },
        routes: [
          { method: "post", path: "/", handler: "create", auth: "public", validation: "c", encryptedFields: ["secret?"] },
          { method: "get", path: "/:id", handler: "read", auth: "public", decryptedFields: ["secret?"], config: { hiddenFields: ["secret"] } },
        ],
      }),
    );
    const { body } = await t.client.post("/v3", { label: "l", secret: "top secret" });
    const one = await t.client.get(`/v3/${body.data._id}`);
    expect(one.status).toBe(200);
    expect(one.body.data.label).toBe("l");
    expect(one.body.data).not.toHaveProperty("secret");
  });

  it("skips optional fields that are absent", async () => {
    t = await boot(vault());
    const { body } = await t.client.post("/vault", { label: "l" });
    expect((await t.client.get(`/vault/${body.data._id}`)).status).toBe(200);
  });

  it("returns 422 FIELD_MISSING for a required encrypted field that is absent", async () => {
    t = await boot(
      collection({
        type: "crud", route: "v2", model: "V2", schema: { label: fields.requiredString, secret: fields.encryptedString } as never,
        validations: { c: { label: z.string(), secret: z.string().optional() } },
        routes: [{ method: "post", path: "/", handler: "create", auth: "public", validation: "c", encryptedFields: ["secret"] }],
      }),
    );
    const res = await t.client.post("/v2", { label: "l" });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("FIELD_MISSING");
  });

  it("refuses to start when a route encrypts fields and no master key is configured", async () => {
    // An option set to `undefined` keeps the test default, so an empty string is how a test says "no master key".
    await expect(authForge({}, { collections: [vault()], masterKey: "" })).rejects.toThrow(
      /masterKey is required because a route uses encryptedFields or decryptedFields.*generateMasterKey/s,
    );
  });
});

describe("actions", () => {
  it("runs 'before' actions and lets them abort the request", async () => {
    let ran = 0;
    t = await boot(notes({ actions: { before: [{ customAction: () => { ran++; throw new ForbiddenError({ message: "blocked by hook", code: "HOOK_BLOCKED" }); } }] } }));
    const a = await user("a@example.com");
    const res = await a.post("/notes", { title: "x" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("HOOK_BLOCKED");
    expect(ran).toBe(1);
    expect(t.data.repository("Note").dump()).toHaveLength(0);
  });

  it("passes the user, model and created item to 'after' actions, and honours a replacement result", async () => {
    let seen: any;
    t = await boot(
      notes({
        actions: {
          after: [
            { customAction: (ctx: any) => { seen = ctx; } },
            { customAction: (ctx: any) => ({ custom: true, title: ctx.item.title }) },
          ],
        },
      }),
    );
    const a = await user("a@example.com");
    const res = await a.post("/notes", { title: "hello" });
    expect(res.body.data).toEqual({ custom: true, title: "hello" });
    expect(seen.operation).toBe("create");
    expect(seen.model).toBe("Note");
    expect(seen.route).toBe("notes");
    expect(seen.user._id).toBeTypeOf("string");
    expect(seen.item.title).toBe("hello");
    expect(seen.result).toMatchObject({ success: true, message: "Note created successfully.", data: { title: "hello" } });
    expect(seen.repository).toBeDefined();
  });

  it("keeps item separate from the mutable response result", async () => {
    let seen: any;
    t = await boot(notes({
      actions: {
        after: [{ customAction: (ctx: any) => {
          seen = ctx;
          ctx.result.message = "Adjusted by hook.";
          ctx.result.data = { title: "adjusted" };
        } }],
      },
    }));
    const a = await user("a@example.com");
    const res = await a.post("/notes", { title: "original" });

    expect(res.body.message).toBe("Adjusted by hook.");
    expect(res.body.data).toEqual({ title: "adjusted" });
    expect(seen.item.title).toBe("original");
    expect(seen.result).toMatchObject({ success: true, message: "Adjusted by hook.", data: { title: "adjusted" } });
  });

  it("lets an action read another model through repositoryOf, for example to check that a referenced document exists", async () => {
    const products = collection({
      type: "crud", route: "products", model: "Product",
      schema: { name: fields.requiredString } as never,
      validations: { create: { name: z.string() } },
      routes: [{ method: "post", path: "/", handler: "create", auth: "public", validation: "create" }],
    });
    const orders = collection({
      type: "crud", route: "orders", model: "Order",
      schema: { product: { mongoose: { type: "ObjectId", ref: "Product", required: true }, zod: fields.requiredObjectId.zod } } as never,
      validations: { create: { product: fields.requiredObjectId } },
      routes: [
        {
          method: "post", path: "/", handler: "create", auth: "authenticated", validation: "create",
          actions: {
            before: [
              {
                customAction: async (ctx: any) => {
                  const id = ctx.req.body?.product;
                  if (typeof id !== "string" || !/^[0-9a-fA-F]{24}$/.test(id)) return; // validation answers 422
                  if (!(await ctx.repositoryOf("Product").findById(id))) {
                    throw new ValidationError({
                      message: "No product has this id.",
                      issues: [{ path: "product", message: "No product has this id.", code: "not_found" }],
                    });
                  }
                },
              },
            ],
          },
        },
      ],
    });
    t = await boot(products, orders);
    const a = await user("a@example.com");
    const product = await t.data.repository("Product").create({ name: "Keyboard" });

    expect((await a.post("/orders", { product: product._id })).status).toBe(201);
    const missing = await a.post("/orders", { product: "f".repeat(24) });
    expect(missing.status).toBe(422);
    expect(missing.body.issues).toEqual([{ path: "product", message: "No product has this id.", code: "not_found" }]);
    expect((await a.post("/orders", { product: "nope" })).body.issues[0].path).toBe("product");
    expect(t.data.repository("Order").dump()).toHaveLength(1);
  });

  it("makes repositoryOf throw for a model that no collection declares", async () => {
    let thrown: any;
    t = await boot(notes({ actions: { before: [{ customAction: (ctx: any) => { try { ctx.repositoryOf("Ghost"); } catch (error) { thrown = error; } } }] } }));
    const a = await user("a@example.com");
    expect((await a.post("/notes", { title: "hello" })).status).toBe(201);
    expect(thrown).toMatchObject({ code: "CONFIGURATION_ERROR", message: expect.stringContaining("Ghost") });
  });

  it("does not report a failure for work that already succeeded when an 'after' action throws", async () => {
    t = await boot(notes({ actions: { after: [{ customAction: () => { throw new Error("hook exploded"); } }] } }));
    const a = await user("a@example.com");
    const res = await a.post("/notes", { title: "kept" });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("kept");
    expect(t.data.repository("Note").dump()).toHaveLength(1);
  });

  it("awaits asynchronous actions (1.x let their rejections crash the process)", async () => {
    const order: string[] = [];
    t = await boot(
      notes({
        actions: {
          before: [{ customAction: async () => { await new Promise((r) => setTimeout(r, 20)); order.push("before"); } }],
          after: [{ customAction: async () => { await new Promise((r) => setTimeout(r, 20)); order.push("after"); } }],
        },
      }),
    );
    const a = await user("a@example.com");
    await a.post("/notes", { title: "x" });
    expect(order).toEqual(["before", "after"]);
  });

  it("sends an e-mail action through the provider", async () => {
    t = await boot(
      notes({
        actions: { after: [{ emailAction: { from: "system-email-sender", to: "ops@example.com", type: "raw", rawBody: "<p>new note</p>", subject: (ctx: any) => `Note by ${ctx.user._id}`.slice(0, 20) } }] },
      }),
    );
    const a = await user("a@example.com");
    await a.post("/notes", { title: "x" });
    expect(t.email.lastTo("ops@example.com")).toMatchObject({ html: "<p>new note</p>", from: "Forge Tests <noreply@forge.test>" });
  });

  it("runs 'before' actions on list, read, update and delete too", async () => {
    const ops: string[] = [];
    const hook = { actions: { before: [{ customAction: (c: any) => void ops.push(c.operation) }] } };
    const base = notes();
    base.routes = base.routes.map((r) => (["readAll", "read", "update", "remove", "removeMultiple", "removeAll", "createBulk"].includes(r.handler) ? { ...r, ...hook } : r));
    t = await boot(base);
    const admin = await makeAdmin(t);
    const id = (await admin.post("/notes", { title: "x" })).body.data._id;
    await admin.get("/notes");
    await admin.get(`/notes/${id}`);
    await admin.patch(`/notes/update/${id}`, { title: "y" });
    await admin.post("/notes/bulk", [{ title: "z" }]);
    await admin.post("/notes/delete-many", { ids: [id] });
    await admin.delete("/notes");
    await admin.delete(`/notes/delete/${id}`);
    expect(ops).toEqual(["readAll", "read", "update", "createBulk", "removeMultiple", "removeAll", "remove"]);
  });
});

describe("startup validation of collections", () => {
  const route = (extra: Record<string, unknown>) => ({ method: "get", path: "/", handler: "readAll", auth: "public", ...extra });
  const base = (routes: any[], extra: Record<string, unknown> = {}): Collection =>
    ({ type: "crud", route: "things", model: "Thing", schema: { name: fields.requiredString }, routes, ...extra }) as Collection;

  const startError = async (c: Collection, options: Record<string, unknown> = {}) => {
    try {
      t = await authForge({}, { collections: [c], ...options });
    } catch (error) {
      return error as Error & { code?: string; details?: { problems?: string[] } };
    }
    throw new Error("expected startup to fail");
  };

  it("refuses unknown handlers for the collection type", async () => {
    const error = await startError(base([route({ handler: "login" })]));
    expect(error.code).toBe("CONFIGURATION_ERROR");
    expect(error.message).toMatch(/handler 'login' is not available/);
  });

  it("refuses an unknown validation key", async () => {
    const error = await startError(base([route({ method: "post", handler: "create", validation: "nope" })]));
    expect(error.message).toMatch(/validation 'nope' is not defined/);
  });

  it("refuses 'validation: true'", async () => {
    const error = await startError(base([route({ method: "post", handler: "create", validation: true })]));
    expect(error.message).toMatch(/ambiguous/);
  });

  it.each(["public", "authenticated"])("refuses removeAll on a '%s' route (anyone could wipe the table)", async (auth) => {
    const error = await startError(base([route({ method: "delete", handler: "removeAll", auth })]));
    expect(error.message).toMatch(/removeAll/);
  });

  describe("populate", () => {
    const withConfig = (config: Record<string, unknown>, schema: Record<string, unknown> = {}) =>
      base([route({ method: "get", handler: "read", path: "/:id", config })], {
        schema: { name: fields.requiredString, owner: fields.userRef, title: { type: String }, ...schema },
      });

    it("accepts a reference, several references and a path inside a subdocument", async () => {
      t = await authForge({}, { collections: [withConfig({ populate: "owner", populateSelect: "_id name" })] });
      await t.close();
      t = await authForge({}, { collections: [withConfig({ populate: "owner kin", populateSelect: "_id name" }, { kin: { mongoose: [{ type: "ObjectId", ref: "User" }], zod: fields.userRefArray.zod } })] });
      await t.close();
      t = await authForge({}, { collections: [withConfig({ populate: "items.product" }, { items: { type: [Object] } })] });
      await t.close();
      t = await authForge({}, { collections: [withConfig({ populate: false })] });
    });

    it("refuses a name that is not a field of the schema", async () => {
      const error = await startError(withConfig({ populate: "author" }));
      expect(error.message).toMatch(/'populate' names 'author', which is not a field of the schema/);
    });

    it("refuses a field that is not a reference", async () => {
      const error = await startError(withConfig({ populate: "title" }));
      expect(error.message).toMatch(/'populate' names 'title', which is not a reference/);
    });

    it("refuses a reference to a model that no collection declares", async () => {
      const error = await startError(withConfig({ populate: "boss" }, { boss: { mongoose: { type: "ObjectId", ref: "Manager" }, zod: fields.objectId.zod } }));
      expect(error.message).toMatch(/'populate' names 'boss', which refers to the model 'Manager'/);
    });

    it("refuses a populateSelect that is empty or lists what to leave out", async () => {
      expect((await startError(withConfig({ populate: "owner", populateSelect: "" }))).message).toMatch(/must list the fields to return/);
      expect((await startError(withConfig({ populate: "owner", populateSelect: "-email" }))).message).toMatch(/starts with '-' or '\+'/);
      expect((await startError(withConfig({ populate: "owner", populateSelect: "_id +secret" }))).message).toMatch(/starts with '-' or '\+'/);
    });

    it("refuses a populate that is not a string", async () => {
      const error = await startError(withConfig({ populate: true }));
      expect(error.message).toMatch(/'populate' must be the name of a field/);
    });
  });

  it("refuses 'files' on handlers that cannot take uploads", async () => {
    const error = await startError(base([route({ files: [{ paramField: "a", schemaField: "b" }] })]), {
      cloudinaryAPIKey: "k", cloudinaryAPISecret: "s", cloudinaryCloudName: "c",
    });
    expect(error.message).toMatch(/files/);
  });

  it("refuses actions with the wrong shape", async () => {
    const error = await startError(base([route({ actions: { before: [{ type: "custom", handler: () => {} }] } })]));
    expect(error.message).toMatch(/customAction/);
  });

  it("reports every problem together", async () => {
    const error = await startError(base([route({ handler: "login" }), route({ handler: "signup", path: "/x" })]));
    expect(error.details?.problems).toHaveLength(2);
    expect(error.message).toMatch(/'login'/);
    expect(error.message).toMatch(/'signup'/);
  });

  it("refuses unknown collection types and unsafe route segments", async () => {
    expect((await startError({ ...base([]), type: "teleport" as never })).message).toMatch(/Unknown collection type/);
    await t?.close();
    expect((await startError({ ...base([]), route: "../admin" })).message).toMatch(/Invalid collection route/);
  });

  it("refuses a crud collection without model or schema", async () => {
    const error = await startError({ type: "crud", route: "x", routes: [] });
    expect(error.message).toMatch(/model.*schema/);
  });
});
