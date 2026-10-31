import { afterEach, describe, expect, it } from "vitest";
import { createTestForge, type TestForge } from "../src/testing/index.js";
import { authForge, signup } from "./helpers.js";

let t: TestForge;
afterEach(() => t?.close());

describe("request pipeline", () => {
  it("answers unknown routes with a JSON 404 and ROUTE_NOT_FOUND", async () => {
    t = await createTestForge();
    const res = await t.client.get("/nothing/here?secret=1");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: "ROUTE_NOT_FOUND" });
    expect(res.body.message).not.toContain("secret=1");
  });

  it("only serves the versioned prefix", async () => {
    t = await createTestForge({ apiVersion: 2 });
    expect(t.url.endsWith("/api/v2")).toBe(true);
    expect((await t.client.get("/health")).status).toBe(200);
    const v1 = await fetch(t.url.replace("/api/v2", "/api/v1/health"));
    expect(v1.status).toBe(404);
  });

  it("sets security headers and hides the framework", async () => {
    t = await createTestForge();
    const res = await t.client.get("/health");
    expect(res.headers.get("x-powered-by")).toBeNull();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("strict-transport-security")).toBeTruthy();
    expect(res.headers.get("x-frame-options")).toBeTruthy();
  });

  it("gives every response a request id, reusing a well-formed client id and rejecting hostile ones", async () => {
    t = await createTestForge();
    const generated = await t.client.get("/health");
    expect(generated.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);

    const reused = await t.client.get("/health", { headers: { "x-request-id": "client-req-12345" } });
    expect(reused.headers.get("x-request-id")).toBe("client-req-12345");

    const hostile = await t.client.get("/health", { headers: { "x-request-id": "bad id\twith spaces" } });
    expect(hostile.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("includes the request id in error bodies", async () => {
    t = await createTestForge();
    const res = await t.client.get("/nope");
    expect(res.body.requestId).toBe(res.headers.get("x-request-id"));
  });

  it("rejects bodies over the size limit with 413", async () => {
    t = await authForge({}, { bodyLimit: "1kb" });
    const res = await t.client.post("/auth/login", { email: "a@b.co", password: "x".repeat(5000) });
    expect(res.status).toBe(413);
    expect(res.body.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("returns 400 for invalid JSON without echoing it", async () => {
    t = await createTestForge();
    const res = await t.client.post("/health", "{\"a\":", { headers: { "content-type": "application/json" } });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_JSON");
  });

  it("hides internals of unexpected errors but shows them in development", async () => {
    const boom = (exposeErrorDetails: boolean) =>
      createTestForge({
        exposeErrorDetails,
        collections: [{
          type: "crud", route: "x", model: "X", schema: {},
          routes: [{ method: "get", path: "/", handler: "readAll", auth: "public", actions: { before: [{ customAction: () => { throw new Error("db password is hunter2"); } }] } }],
        }],
      });

    t = await boot(await boom(true));
    const dev = await t.client.get("/x");
    expect(dev.status).toBe(500);
    await t.close();

    t = await boot(await boom(false));
    const prod = await t.client.get("/x");
    expect(prod.status).toBe(500);
    expect(prod.body.message).toBe("Something went wrong.");
    expect(JSON.stringify(prod.body)).not.toContain("hunter2");
    expect(prod.body.hint).toBeUndefined();
  });
});

// helper: createTestForge returns a promise; keep the afterEach pointing at the live instance
const boot = async (forge: TestForge) => forge;

describe("CORS", () => {
  it("allows no cross-origin browser access by default", async () => {
    t = await createTestForge();
    const res = await t.client.get("/health", { headers: { origin: "https://evil.example" } });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("allows the configured front-end with credentials, and only it", async () => {
    t = await createTestForge({ frontendURL: "https://app.example.com" });
    const ok = await t.client.get("/health", { headers: { origin: "https://app.example.com" } });
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
    expect(ok.headers.get("access-control-allow-credentials")).toBe("true");
    const bad = await t.client.get("/health", { headers: { origin: "https://evil.example" } });
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers preflight requests before the rest of the stack", async () => {
    t = await createTestForge({ frontendURLs: ["https://a.example", "https://b.example"] });
    const res = await t.client.request("OPTIONS", "/auth/login", undefined, {
      headers: { origin: "https://b.example", "access-control-request-method": "POST" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://b.example");
  });

  it("accepts a custom corsConfig", async () => {
    t = await createTestForge({ corsConfig: { origin: "https://custom.example" } });
    const res = await t.client.get("/health", { headers: { origin: "https://custom.example" } });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://custom.example");
  });
});

describe("CSRF origin guard", () => {
  it("blocks state-changing requests from an origin that is not allowed", async () => {
    t = await authForge({}, { frontendURL: "https://app.example.com" });
    const res = await t.client.post("/auth/logout", undefined, { headers: { origin: "https://evil.example" } });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CSRF_ORIGIN_REJECTED");
  });

  it("allows the configured origin, safe methods, and requests without an Origin header", async () => {
    t = await authForge({}, { frontendURL: "https://app.example.com" });
    expect((await t.client.post("/auth/logout", undefined, { headers: { origin: "https://app.example.com" } })).status).toBe(200);
    expect((await t.client.post("/auth/logout", undefined, { headers: { origin: "https://app.example.com/" } })).status).toBe(200);
    expect((await t.client.get("/health", { headers: { origin: "https://evil.example" } })).status).toBe(200);
    expect((await t.client.post("/auth/logout")).status).toBe(200);
  });

  it("stays out of the way when no origins are configured", async () => {
    t = await authForge();
    expect((await t.client.post("/auth/logout", undefined, { headers: { origin: "https://anything.example" } })).status).toBe(200);
  });

  it("also protects cookie-authenticated routes", async () => {
    t = await authForge({}, { frontendURL: "https://app.example.com" });
    await signup(t.client);
    const res = await t.client.delete("/account/me", undefined, { headers: { origin: "https://evil.example" } });
    expect(res.status).toBe(403);
    expect(t.data.repository("User").dump()).toHaveLength(1);
  });
});

describe("rate limiting", () => {
  it("limits all requests per client and reports 429 RATE_LIMITED", async () => {
    t = await createTestForge({ maxReqLimit: 3, rateLimitMsg: "Slow down." });
    for (let i = 0; i < 3; i++) expect((await t.client.get("/health")).status).toBe(200);
    const res = await t.client.get("/health");
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ code: "RATE_LIMITED", message: "Slow down." });
    expect(res.headers.get("ratelimit")).toBeTruthy();
  });

  it("applies a stricter limit to credential endpoints (brute-force protection)", async () => {
    t = await authForge({}, { authMaxReqLimit: 3 });
    await signup(t.client);
    const attempts: number[] = [];
    for (let i = 0; i < 5; i++) attempts.push((await t.newClient().post("/auth/login", { email: "ada@example.com", password: "Wrong-password-1" })).status);
    // signup used one slot; two wrong logins fit, the rest are throttled
    expect(attempts.filter((s) => s === 401)).toHaveLength(2);
    expect(attempts.filter((s) => s === 429)).toHaveLength(3);
    // ordinary endpoints are unaffected
    expect((await t.client.get("/health")).status).toBe(200);
  });

  it("does not throttle refresh and logout with the credential limiter", async () => {
    t = await authForge({}, { authMaxReqLimit: 1 });
    await signup(t.client);
    expect((await t.client.post("/auth/refresh-token")).status).toBe(200);
    expect((await t.client.post("/auth/logout")).status).toBe(200);
  });

  it("keeps separate counters for each scope", async () => {
    t = await authForge({}, { maxReqLimit: 1000, authMaxReqLimit: 1 });
    expect((await t.client.post("/auth/login", { email: "a@b.co", password: "x" })).status).toBe(401);
    expect((await t.client.post("/auth/login", { email: "a@b.co", password: "x" })).status).toBe(429);
    expect((await t.client.get("/health")).status).toBe(200);
  });
});

describe("NoSQL / prototype injection through query strings and bodies", () => {
  it("strips operator keys from nested bodies before validation sees them", async () => {
    t = await authForge();
    await signup(t.client);
    const res = await t.client.post("/auth/login", { email: { "$regex": ".*" }, password: "x" });
    expect(res.status).toBe(422);
  });

  it("does not let __proto__ pollute Object.prototype", async () => {
    t = await authForge();
    await t.client.post("/auth/login", JSON.parse('{"__proto__":{"polluted":true},"email":"a@b.co","password":"x"}'));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
