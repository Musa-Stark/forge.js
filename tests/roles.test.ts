import { z } from "zod";
import { afterEach, describe, expect, it } from "vitest";
import { collection, fields, type AccessLevel, type AuthRole, type Collection } from "../src/index.js";
import { ROLES } from "../src/fields/roles.js";
import { Authenticator } from "../src/http/Authenticator.js";
import { TokenService } from "../src/security/TokenService.js";
import { createTestForge, InMemoryDataSource, testAuthConfig, type TestForge } from "../src/testing/index.js";
import { ForgeConfig } from "../src/config/ForgeConfig.js";
import { Logger, type LogSink } from "../src/utils/Logger.js";
import { authForge, signup } from "./helpers.js";

let t: TestForge | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
});

const setRole = async (email: string, role: string | null) => {
  const user = (await t!.data.repository("User").findOne({ email }))!;
  await t!.data.repository("User").updateById(user._id, { role });
};

/** A signed-in client whose account has `role`. */
const withRole = async (role: string, email = `${role.replace(/\W/g, "")}@example.com`) => {
  const client = t!.newClient();
  await signup(client, email);
  await setRole(email, role);
  return client;
};

const recordingLogger = () => {
  const lines: string[] = [];
  const sink: LogSink = { write: (level, message) => void lines.push(`${level}: ${message}`) };
  return { lines, logger: new Logger("warn", sink) };
};

const articles = (): Collection =>
  collection({
    type: "crud",
    route: "articles",
    model: "Article",
    schema: { title: fields.requiredString, owner: fields.userRef } as never,
    validations: { create: { title: z.string().min(1) }, update: { title: z.string().min(1).optional() } },
    routes: [
      { method: "get", path: "/", handler: "readAll", auth: "public" },
      { method: "post", path: "/", handler: "create", auth: "authenticated", roles: ["editor", "admin"], validation: "create" },
      { method: "patch", path: "/update/:id", handler: "update", auth: "admin-or-owner", roles: ["editor", "admin"], validation: "update" },
      { method: "delete", path: "/delete/:id", handler: "remove", auth: "authenticated", roles: ["moderator"] },
    ],
  });

describe("GET /account/role: the role check works for every role, not only admins", () => {
  it("returns the caller's role and whether it counts as administrator", async () => {
    t = await authForge();
    await signup(t.client);
    const res = await t.client.get("/account/role");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Role found successfully.");
    expect(res.body.data).toEqual({ role: "user", isAdmin: false });
  });

  it.each([...ROLES])("returns '%s' as-is", async (role) => {
    t = await authForge();
    const client = await withRole(role);
    const res = await client.get("/account/role");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ role, isAdmin: role === "admin" });
  });

  it("treats exactly the configured adminRoles as administrators", async () => {
    t = await authForge({}, { adminRoles: ["owner", "super_admin"] });
    expect((await (await withRole("owner")).get("/account/role")).body.data.isAdmin).toBe(true);
    expect((await (await withRole("super_admin")).get("/account/role")).body.data.isAdmin).toBe(true);
    expect((await (await withRole("admin")).get("/account/role")).body.data.isAdmin).toBe(false);
  });

  it("returns the role only, nothing else about the account", async () => {
    t = await authForge();
    await signup(t.client);
    const { data } = (await t.client.get("/account/role")).body;
    expect(Object.keys(data).sort()).toEqual(["isAdmin", "role"]);
  });

  it("requires a signed-in user", async () => {
    t = await authForge();
    expect((await t.client.get("/account/role")).status).toBe(401);
    expect((await t.client.get("/account/role", { headers: { authorization: "Bearer nonsense" } })).status).toBe(401);
  });

  it("accepts the Bearer token as well as the cookie", async () => {
    t = await authForge();
    const { body } = await signup(t.client);
    const res = await t.newClient().get("/account/role", { headers: { authorization: `Bearer ${body.accessToken}` } });
    expect(res.body.data.role).toBe("user");
  });

  it("reflects a role change at once, without signing in again", async () => {
    t = await authForge();
    await signup(t.client);
    expect((await t.client.get("/account/role")).body.data.role).toBe("user");
    await setRole("ada@example.com", "editor");
    expect((await t.client.get("/account/role")).body.data).toEqual({ role: "editor", isAdmin: false });
    await setRole("ada@example.com", "admin");
    expect((await t.client.get("/account/role")).body.data.isAdmin).toBe(true);
  });

  it("answers 404 ROLE_NOT_FOUND with a hint when the account has no role", async () => {
    t = await authForge();
    await signup(t.client);
    await setRole("ada@example.com", null);
    const res = await t.client.get("/account/role");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ROLE_NOT_FOUND");
    expect(res.body.hint).toMatch(/'role' field/);
  });

  it("answers 404 ROLE_NOT_FOUND when the user schema has no role field at all", async () => {
    t = await authForge({
      mongooseConfig: { model: "User", schema: { name: fields.requiredString, email: fields.email, password: fields.password } },
    });
    await signup(t.client);
    const res = await t.client.get("/account/role");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ROLE_NOT_FOUND");
  });

  it("reads the role from the database when the authenticator did not (verifyAccessUser: false)", async () => {
    t = await createTestForge({ builtinConfig: { auth: testAuthConfig({ verifyAccessUser: false }), account: { mode: "builtin" } } });
    await signup(t.client);
    await setRole("ada@example.com", "moderator");
    expect((await t.client.get("/account/role")).body.data).toEqual({ role: "moderator", isAdmin: false });
    await setRole("ada@example.com", null);
    expect((await t.client.get("/account/role")).body.code).toBe("ROLE_NOT_FOUND");
  });

  it("can be mounted on a custom path of your own account collection", async () => {
    t = await authForge({}, {
      collections: [{ type: "account", route: "profile", routes: [{ method: "get", path: "/whoami", handler: "checkRole" }] }],
    });
    await signup(t.client);
    expect((await t.client.get("/profile/whoami")).body.data.role).toBe("user");
    expect((await t.newClient().get("/profile/whoami")).status).toBe(401);
  });
});

describe("the old, admin-named versions keep working (deprecated)", () => {
  it("GET /admin/check returns the role now, and stays admin-only", async () => {
    t = await authForge();
    const admin = await withRole("admin");
    expect((await admin.get("/admin/check")).body.data).toEqual({ role: "admin", isAdmin: true });

    const user = await withRole("user", "plain@example.com");
    const denied = await user.get("/admin/check");
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe("ADMIN_REQUIRED");
    expect((await t.newClient().get("/admin/check")).status).toBe(401);
  });

  it("warns about builtinConfig.admin at startup, pointing at the replacement", async () => {
    const { lines, logger } = recordingLogger();
    t = await authForge({}, {}, { logger });
    expect(lines.join("\n")).toMatch(/builtinConfig\.admin is deprecated.*GET \/account\/role/);
  });

  it("a type:'admin' collection with the 1.x handler 'checkAdmin' still works, returns the role, and warns", async () => {
    const { lines, logger } = recordingLogger();
    t = await authForge({}, { collections: [{ type: "admin", route: "ops", routes: [{ method: "get", path: "/ping", handler: "checkAdmin" }] }] }, { logger });
    const admin = await withRole("admin");
    expect((await admin.get("/ops/ping")).body.data).toEqual({ role: "admin", isAdmin: true });
    expect((await (await withRole("user", "plain@example.com")).get("/ops/ping")).status).toBe(403);
    expect(lines.join("\n")).toMatch(/'ops': handler 'checkAdmin' is deprecated.*checkRole/);
  });

  it("the new handler name on an admin collection does not warn, and the route can open the check to every role", async () => {
    const { lines, logger } = recordingLogger();
    t = await authForge({}, { collections: [{ type: "admin", route: "ops", routes: [{ method: "get", path: "/me", handler: "checkRole", auth: "authenticated" }] }] }, { logger });
    const editor = await withRole("editor");
    expect((await editor.get("/ops/me")).body.data).toEqual({ role: "editor", isAdmin: false });
    expect(lines.join("\n")).not.toMatch(/'ops'/);
  });

  it("AuthRole is still exported, as an alias of AccessLevel", () => {
    const level: AccessLevel = "admin-or-owner";
    const old: AuthRole = level;
    expect(old).toBe("admin-or-owner");
  });

  it("checkRole is not offered to crud collections (clear startup error)", async () => {
    await expect(authForge({}, { collections: [{ type: "crud", route: "x", model: "X", schema: {}, routes: [{ method: "get", path: "/", handler: "checkRole" }] }] })).rejects.toThrow(
      /handler 'checkRole' is not available for collections of type 'crud'/,
    );
  });
});

describe("restricting a route to specific roles", () => {
  const create = (client: { post: Function }, title = "Hello") => client.post("/articles", { title });

  it("lets the listed roles through and refuses everyone else with 403 ROLE_NOT_ALLOWED", async () => {
    t = await authForge({}, { collections: [articles()] });
    const editor = await withRole("editor");
    const admin = await withRole("admin");
    expect((await create(editor)).status).toBe(201);
    expect((await create(admin)).status).toBe(201);

    for (const role of ["user", "moderator", "author", "guest", "super_admin"]) {
      const res = await create(await withRole(role));
      expect(res.status, role).toBe(403);
      expect(res.body.code).toBe("ROLE_NOT_ALLOWED");
    }
    expect(t.data.repository("Article").dump()).toHaveLength(2);
  });

  it("tells a developer which roles are allowed (and a production deployment does not)", async () => {
    t = await authForge({}, { collections: [articles()] });
    const res = await create(await withRole("user"));
    expect(res.body.hint).toBe("Allowed roles: editor, admin.");
    await t.close();

    t = await authForge({}, { collections: [articles()], exposeErrorDetails: false });
    const prod = await create(await withRole("user"));
    expect(prod.status).toBe(403);
    expect(prod.body.hint).toBeUndefined();
    expect(JSON.stringify(prod.body)).not.toContain("editor");
  });

  it("asks for a login first: anonymous callers get 401, not 403", async () => {
    t = await authForge({}, { collections: [articles()] });
    expect((await create(t.newClient())).status).toBe(401);
  });

  it("is exact: admins are not implicitly allowed, and case matters", async () => {
    t = await authForge({}, { collections: [articles()] });
    const made = (await create(await withRole("editor"))).body.data._id;

    // The delete route lists only "moderator".
    expect((await (await withRole("admin")).delete(`/articles/delete/${made}`)).status).toBe(403);
    expect((await (await withRole("Moderator", "caps@example.com")).delete(`/articles/delete/${made}`)).status).toBe(403);
    expect((await (await withRole("moderator")).delete(`/articles/delete/${made}`)).status).toBe(200);
  });

  it("follows role changes immediately, in both directions", async () => {
    t = await authForge({}, { collections: [articles()] });
    const client = await withRole("user", "ada@example.com");
    expect((await create(client)).status).toBe(403);
    await setRole("ada@example.com", "editor");
    expect((await create(client)).status).toBe(201);
    await setRole("ada@example.com", "user");
    expect((await create(client)).status).toBe(403);
  });

  it("refuses accounts that have no role at all", async () => {
    t = await authForge({}, { collections: [articles()] });
    const client = await withRole("editor", "ada@example.com");
    await setRole("ada@example.com", null);
    expect((await create(client)).status).toBe(403);
  });

  it("is checked before any work: a refused request validates nothing and saves nothing", async () => {
    t = await authForge({}, { collections: [articles()] });
    const res = await (await withRole("user")).post("/articles", { title: "" }); // would be a 422 if it got that far
    expect(res.status).toBe(403);
    expect(t.data.repository("Article").dump()).toHaveLength(0);
  });

  it("does not affect public routes of the same collection", async () => {
    t = await authForge({}, { collections: [articles()] });
    await create(await withRole("editor"));
    const list = await t.newClient().get("/articles");
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
  });

  it("combines with 'admin-or-owner': both the role and the ownership must pass", async () => {
    t = await authForge({}, { collections: [articles()] });
    const owner = await withRole("editor", "owner@example.com");
    const id = (await create(owner)).body.data._id;

    expect((await owner.patch(`/articles/update/${id}`, { title: "mine" })).status).toBe(200);

    const otherEditor = await withRole("editor", "other@example.com");
    const notOwner = await otherEditor.patch(`/articles/update/${id}`, { title: "x" });
    expect(notOwner.status).toBe(403);
    expect(notOwner.body.code).toBe("OWNER_REQUIRED");

    // An owner whose role was taken away is refused by the role rule, ownership notwithstanding.
    await setRole("owner@example.com", "user");
    const demoted = await owner.patch(`/articles/update/${id}`, { title: "y" });
    expect(demoted.status).toBe(403);
    expect(demoted.body.code).toBe("ROLE_NOT_ALLOWED");

    expect((await (await withRole("admin")).patch(`/articles/update/${id}`, { title: "by admin" })).status).toBe(200);
  });

  it("also works on routes of other collection types", async () => {
    t = await authForge({}, {
      collections: [{ type: "health", route: "internal", routes: [{ method: "get", path: "/", handler: "healthGet", auth: "authenticated", roles: ["support"] }] }],
    });
    expect((await (await withRole("support")).get("/internal")).status).toBe(200);
    expect((await (await withRole("user")).get("/internal")).status).toBe(403);
  });
});

describe("startup checks for 'roles'", () => {
  const route = (extra: Record<string, unknown>) => ({ method: "get", path: "/", handler: "readAll", auth: "authenticated", ...extra });
  const start = (routes: unknown[], options: Record<string, unknown> = {}) =>
    authForge({}, { collections: [{ type: "crud", route: "things", model: "Thing", schema: { name: fields.requiredString } as never, routes: routes as never }], ...options });

  it("accepts roles on authenticated and admin-or-owner routes", async () => {
    t = await start([route({ roles: ["editor"] }), route({ path: "/b", auth: "admin-or-owner", roles: ["editor", "admin"] })]);
    expect(t).toBeDefined();
  });

  it("refuses roles on a public route (nobody is signed in to have a role)", async () => {
    await expect(start([route({ auth: "public", roles: ["editor"] })])).rejects.toThrow(/'roles' cannot be used on a 'public' route/);
  });

  it("refuses roles together with auth 'admin' and says what to do instead", async () => {
    await expect(start([route({ auth: "admin", roles: ["editor"] })])).rejects.toThrow(/cannot be combined with auth 'admin'.*adminRoles.*authenticated/);
  });

  it.each([[[]], ["editor"], [[""]], [[1, 2]], [[null]]])("refuses the malformed value %j", async (roles) => {
    await expect(start([route({ roles })])).rejects.toThrow(/'roles' must be a non-empty array of role names/);
  });

  it("refuses role checks when the user lookup that supplies the role is switched off", async () => {
    await expect(start([route({ roles: ["editor"] })], {})).resolves.toBeDefined();
    await t?.close();
    t = undefined;
    const config = () => new ForgeConfig({ ENV: "test", jwtSecret: "j".repeat(40) });
    expect(config).not.toThrow();
    await expect(
      createTestForge({
        builtinConfig: { auth: testAuthConfig({ verifyAccessUser: false }), account: { mode: "builtin" } },
        collections: [{ type: "crud", route: "things", model: "Thing", schema: { name: fields.requiredString } as never, routes: [route({ roles: ["editor"] }), route({ path: "/a", auth: "admin" }), route({ path: "/o", auth: "admin-or-owner" })] as never }],
      }),
    ).rejects.toThrow(/needs auth\.verifyAccessUser: true/);
  });

  it("reports every problem at once", async () => {
    await expect(start([route({ auth: "public", roles: ["a"] }), route({ path: "/x", roles: [] })])).rejects.toThrow(/public' route[\s\S]*non-empty array/);
  });

  it("the built-in admin route needs verifyAccessUser too (a silent lock-out in 1.x)", async () => {
    await expect(
      createTestForge({ builtinConfig: { auth: testAuthConfig({ verifyAccessUser: false }), admin: { mode: "builtin" } } }),
    ).rejects.toThrow(/needs auth\.verifyAccessUser: true/);
  });
});

describe("Authenticator.hasAnyRole", () => {
  const auth = new Authenticator(new ForgeConfig({ ENV: "test" }), new TokenService("s".repeat(40)), new InMemoryDataSource());
  const user = (role?: string) => ({ _id: "a".repeat(24), role });

  it("matches exactly, case-sensitively", () => {
    expect(auth.hasAnyRole(user("editor"), ["editor", "admin"])).toBe(true);
    expect(auth.hasAnyRole(user("admin"), ["editor", "admin"])).toBe(true);
    expect(auth.hasAnyRole(user("Editor"), ["editor"])).toBe(false);
    expect(auth.hasAnyRole(user("edit"), ["editor"])).toBe(false);
    expect(auth.hasAnyRole(user("editor "), ["editor"])).toBe(false);
  });

  it("is false for a missing user, a missing role and an empty list", () => {
    expect(auth.hasAnyRole(undefined, ["editor"])).toBe(false);
    expect(auth.hasAnyRole(user(undefined), ["editor"])).toBe(false);
    expect(auth.hasAnyRole(user(""), [""])).toBe(false);
    expect(auth.hasAnyRole(user("editor"), [])).toBe(false);
  });
});
