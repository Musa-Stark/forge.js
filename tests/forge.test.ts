import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  collection, FeatureModule, Forge, ForgeConfig, StarkForge, startServer, type HandlerFn, type Services,
} from "../src/index.js";
import fields from "../src/fields/unified.fields.js";
import { createTestForge, FakeEmailProvider, InMemoryDataSource, testAuthConfig, TEST_JWT_SECRET, type TestForge } from "../src/testing/index.js";
import { authForge, login, refreshTokenRows, signup } from "./helpers.js";
import { z } from "zod";

let t: TestForge | undefined;
const extra: Forge[] = [];
afterEach(async () => {
  await t?.close();
  t = undefined;
  await Promise.all(extra.splice(0).map((f) => f.stop()));
});

describe("lifecycle", () => {
  it("starts once, serves requests, and stops cleanly", async () => {
    t = await createTestForge();
    const server = await t.forge.start();
    expect(server).toBe(await t.forge.start());
    expect((await t.client.get("/health")).status).toBe(200);

    await t.forge.stop();
    await expect(fetch(`${t.url}/health`)).rejects.toThrow();
    await expect(t.forge.stop()).resolves.toBeUndefined();
    t = undefined;
  });

  it("build() is idempotent and does not open a port", async () => {
    const forge = new Forge({ ENV: "test" }, { dataSource: new InMemoryDataSource() });
    expect(forge.build()).toBe(forge.build());
  });

  it("parses JSON and URL-encoded bodies on app routes registered before build()", async () => {
    const forge = new Forge({ ENV: "test", port: 0 }, { dataSource: new InMemoryDataSource() });
    forge.app.post("/custom-body", (req, res) => res.json({ body: req.body }));
    const server = forge.build().listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    try {
      const json = await fetch(`${base}/custom-body`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "json" }),
      });
      const form = await fetch(`${base}/custom-body`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "source=form",
      });

      expect(await json.json()).toEqual({ body: { source: "json" } });
      expect(await form.json()).toEqual({ body: { source: "form" } });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("applies CORS and helmet to forge.app routes registered before start()", async () => {
    const forge = new Forge(
      { ENV: "test", port: 0, frontendURL: "https://app.example.com" },
      { dataSource: new InMemoryDataSource() },
    );
    extra.push(forge);
    forge.app.get("/custom-cors", (_req, res) => res.json({ ok: true }));

    const server = await forge.start();
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const custom = await fetch(`${base}/custom-cors`, {
      headers: { origin: "https://app.example.com" },
    });
    expect(custom.status).toBe(200);
    expect(custom.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
    expect(custom.headers.get("access-control-allow-credentials")).toBe("true");
    expect(custom.headers.get("x-content-type-options")).toBe("nosniff");

    const builtin = await fetch(`${base}${forge.config.apiPrefix}/health`, {
      headers: { origin: "https://app.example.com" },
    });
    expect(builtin.status).toBe(200);
    expect(builtin.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
  });

  it("rejects start() when the port is taken", async () => {
    t = await createTestForge();
    const port = Number(new URL(t.url).port);
    const second = new Forge({ ENV: "test", port }, { dataSource: new InMemoryDataSource() });
    extra.push(second);
    await expect(second.start()).rejects.toMatchObject({ code: "EADDRINUSE" });
  });

  it("closes the database on stop", async () => {
    let disconnected = 0;
    const data = new InMemoryDataSource();
    data.disconnect = async () => void disconnected++;
    const forge = new Forge({ ENV: "test", port: 0 }, { dataSource: data });
    await forge.start();
    await forge.stop();
    expect(disconnected).toBe(1);
  });

  it("serves with the real Mongoose data source wired in (no database connection needed to boot)", async () => {
    const forge = new Forge({
      ENV: "test", port: 0, isOffline: true,
      collections: [collection({ type: "crud", route: "things", model: "Thing", schema: { name: fields.requiredString } as never, validations: { c: { name: z.string() } }, routes: [{ method: "post", path: "/", handler: "create", auth: "public", validation: "c" }] })],
    });
    const server = forge.build().listen(0);
    await new Promise((r) => server.once("listening", r));
    try {
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
      const health = await fetch(`${base}/health`);
      expect(health.status).toBe(503);
      expect(((await health.json()) as any).data).toMatchObject({ status: "degraded", database: "down" });
      expect((await fetch(`${base}/things`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status).toBe(422);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});

describe("configuration at startup", () => {
  it("throws a ConfigurationError instead of exiting the process", () => {
    expect(() => new Forge({ port: -5 })).toThrow(/port/);
  });

  it("requires builtin auth for builtin account/admin", () => {
    expect(() => new ForgeConfig({ jwtSecret: TEST_JWT_SECRET, builtinConfig: { account: { mode: "builtin" } } })).toThrow(/needs builtinConfig.auth/);
    expect(() => new ForgeConfig({ jwtSecret: TEST_JWT_SECRET, builtinConfig: { admin: { mode: "builtin" } } })).toThrow(/needs builtinConfig.auth/);
  });

  it("an account collection without any user model fails at startup with a hint", async () => {
    await expect(
      createTestForge({ jwtSecret: TEST_JWT_SECRET, collections: [{ type: "account", route: "me", routes: [{ method: "get", path: "/me", handler: "getMe" }] }] }),
    ).rejects.toMatchObject({ code: "CONFIGURATION_ERROR", hint: expect.stringContaining("auth") });
  });

  it("generates the built-in routes through the same pipeline as user collections", async () => {
    t = await authForge();
    const routes = t.forge.collections.flatMap((c) => c.routes.map((r) => `${r.method} /${c.route}${r.path}`));
    expect(routes).toEqual(expect.arrayContaining([
      "post /auth/signup", "post /auth/login", "post /auth/verify-otp", "post /auth/resend-otp", "post /auth/forgot-password",
      "post /auth/reset-password", "post /auth/refresh-token", "post /auth/logout",
      "get /account/me", "patch /account/me", "delete /account/me", "get /account/role", "get /admin/check", "get /health/",
    ]));
  });
});

describe("manual mode (user-defined auth collection)", () => {
  it("works end to end without builtinConfig.auth", async () => {
    t = await createTestForge({
      collections: [collection({
        type: "auth", route: "people", model: "Person",
        schema: { email: fields.email, password: fields.password, name: fields.requiredString } as never,
        validations: {
          register: { email: fields.email.zod!, password: fields.password.zod!, name: z.string() },
          signin: { email: fields.email.zod!, password: z.string().min(1) },
        },
        routes: [
          { method: "post", path: "/register", handler: "signup", validation: "register", mode: "credentials" },
          { method: "post", path: "/signin", handler: "login", validation: "signin", mode: "credentials" },
          { method: "post", path: "/signout", handler: "logout" },
        ],
      }),
      collection({ type: "admin", route: "ops", routes: [{ method: "get", path: "/ping", handler: "checkAdmin" }] })],
    });
    const reg = await t.client.post("/people/register", { email: "a@b.co", name: "A", password: "Sup3r-secret-pw" });
    expect(reg.status).toBe(201);
    expect(reg.body.data.password).toBeUndefined();
    expect((await t.newClient().post("/people/signin", { email: "a@b.co", password: "Sup3r-secret-pw" })).status).toBe(200);
    expect((await t.newClient().post("/people/signin", { email: "a@b.co", password: "nope" })).body.code).toBe("INVALID_CREDENTIALS");
    expect((await t.client.get("/ops/ping")).status).toBe(403);
  });
});

describe("manual auth collections are protected too", () => {
  it("ignores a role in the sign-up body even when the developer's own validation allows it", async () => {
    t = await createTestForge({
      collections: [collection({
        type: "auth", route: "people", model: "Person",
        schema: { email: fields.email, password: fields.password, role: { type: String, default: "user" } } as never,
        validations: { register: { email: fields.email.zod!, password: fields.password.zod!, role: z.string().optional() } },
        routes: [{ method: "post", path: "/register", handler: "signup", validation: "register", mode: "credentials" }],
      }),
      collection({ type: "admin", route: "ops", routes: [{ method: "get", path: "/ping", handler: "checkAdmin" }] })],
    });
    const res = await t.client.post("/people/register", { email: "mallory@b.co", password: "Sup3r-secret-pw", role: "admin" });
    expect(res.status).toBe(201);
    expect(t.data.repository("Person").dump()[0]!.role).toBe("user");
    expect((await t.client.get("/ops/ping")).status).toBe(403);
  });
});

describe("custom feature modules", () => {
  class EchoModule extends FeatureModule {
    readonly type = "echo";
    constructor(services: Services) { super(services); }
    protected handlers(): Readonly<Record<string, HandlerFn>> {
      return {
        say: async (req, res) => {
          this.services.responses.success(res, { message: "echo", data: { you: req.user?._id ?? null, q: req.query.q } });
        },
      };
    }
  }

  it("lets you add a collection type with the same auth, rate-limit and error pipeline", async () => {
    const data = new InMemoryDataSource();
    const forge = new Forge(
      { ENV: "test", port: 0, jwtSecret: TEST_JWT_SECRET, builtinConfig: { auth: testAuthConfig() }, collections: [{ type: "echo" as never, route: "echo", routes: [{ method: "get", path: "/", handler: "say" as never, auth: "authenticated" }] }] },
      { dataSource: data, emailProvider: new FakeEmailProvider() },
    );
    forge.use(new EchoModule(forge.services));
    extra.push(forge);
    const server = await forge.start();
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;

    expect((await fetch(`${base}/echo?q=1`)).status).toBe(401);
    const signupRes = await fetch(`${base}/auth/signup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "A", email: "a@b.co", password: "Sup3r-secret-pw" }) });
    const { accessToken } = (await signupRes.json()) as { accessToken: string };
    const res = await fetch(`${base}/echo?q=hi`, { headers: { authorization: `Bearer ${accessToken}` } });
    expect(((await res.json()) as any).data.q).toBe("hi");
  });

  it("refuses use() after the app was built", async () => {
    t = await createTestForge();
    expect(() => t!.forge.use(new EchoModule(t!.forge.services))).toThrow(/before build/);
  });
});

describe("proxy awareness", () => {
  it("records the connecting address, ignoring X-Forwarded-For unless trustProxy is set", async () => {
    t = await authForge();
    await signup(t.client, "a@example.com", {});
    await login(t.newClient());
    // sign up with a spoofed header
    const spoof = t.newClient();
    await spoof.post("/auth/login", { email: "a@example.com", password: "Sup3r-secret-pw" }, { headers: { "x-forwarded-for": "6.6.6.6" } });
    expect(refreshTokenRows(t).map((r) => r.ip)).not.toContain("6.6.6.6");
    await t.close();

    t = await authForge({}, { trustProxy: true });
    await signup(t.client, "a@example.com", {});
    await t.newClient().post("/auth/login", { email: "a@example.com", password: "Sup3r-secret-pw" }, { headers: { "x-forwarded-for": "198.51.100.7" } });
    expect(refreshTokenRows(t).map((r) => r.ip)).toContain("198.51.100.7");
  });
});

describe("1.x compatibility shims", () => {
  it("exports StarkForge and startServer", async () => {
    const forge = new StarkForge({ ENV: "test", port: 0 }, { dataSource: new InMemoryDataSource() });
    extra.push(forge);
    expect(forge).toBeInstanceOf(Forge);
    await startServer();
    expect(forge.services.config.port).toBe(0);
  });

  it("startServer() explains what to do when nothing was created", async () => {
    const saved = Forge.lastCreated;
    Forge.lastCreated = undefined;
    await expect(startServer()).rejects.toThrow(/Create a Forge instance/);
    Forge.lastCreated = saved;
  });
});

describe("createTestForge", () => {
  it("keeps its defaults when an option is undefined (for example an unset environment variable)", async () => {
    t = await createTestForge({ ENV: undefined, jwtSecret: undefined, masterKey: undefined, builtinConfig: { auth: testAuthConfig() } });
    expect(t.forge.config.env).toBe("test");
    expect(t.forge.config.jwtSecret).toBe(TEST_JWT_SECRET);
    expect((await t.client.get("/health")).status).toBe(200);
  });
});
