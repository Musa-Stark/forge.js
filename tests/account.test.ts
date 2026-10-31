import { afterEach, describe, expect, it } from "vitest";
import type { TestForge } from "../src/testing/index.js";
import { authForge, login, makeAdmin, PASSWORD, refreshTokenRows, signup } from "./helpers.js";

let t: TestForge;
afterEach(() => t?.close());

describe("account (/me)", () => {
  it("returns the signed-in user's profile without secrets", async () => {
    t = await authForge();
    await signup(t.client);
    const res = await t.client.get("/account/me");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: "Ada", email: "ada@example.com" });
    expect(res.body.data.password).toBeUndefined();
  });

  it("requires authentication", async () => {
    t = await authForge();
    expect((await t.client.get("/account/me")).status).toBe(401);
    expect((await t.client.patch("/account/me", { name: "x" })).status).toBe(401);
    expect((await t.client.delete("/account/me")).status).toBe(401);
  });

  it("updates profile fields", async () => {
    t = await authForge();
    await signup(t.client);
    const res = await t.client.patch("/account/me", { name: "Ada Lovelace" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Ada Lovelace");
    expect(res.body.message).toBe("Profile updated successfully.");
  });

  it("works with a partial body (1.x demanded every hashed field)", async () => {
    t = await authForge();
    await signup(t.client);
    expect((await t.client.patch("/account/me", {})).status).toBe(200);
  });

  it("cannot be used to change your own role (privilege escalation)", async () => {
    t = await authForge();
    await signup(t.client);
    const res = await t.client.patch("/account/me", { role: "admin", name: "Ada" });
    expect(res.status).toBe(200);
    expect(t.data.repository("User").dump()[0]!.role).toBe("user");
    expect((await t.client.get("/admin/check")).status).toBe(403);
  });

  it("cannot be used to take over someone else's account", async () => {
    t = await authForge();
    await signup(t.client);
    await signup(t.newClient(), "bob@example.com");
    const res = await t.client.patch("/account/me", { email: "bob@example.com" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DUPLICATE_KEY");
  });

  describe("changing the password", () => {
    it("requires the current password", async () => {
      t = await authForge();
      await signup(t.client);
      const none = await t.client.patch("/account/me", { password: "Brand-new-pass-9" });
      expect(none.status).toBe(401);
      expect(none.body.code).toBe("INVALID_CREDENTIALS");
      const wrong = await t.client.patch("/account/me", { password: "Brand-new-pass-9", currentPassword: "Wrong-password-1" });
      expect(wrong.status).toBe(401);
      expect((await login(t.newClient())).status).toBe(200);
    });

    it("hashes the new password, closes every session and requires a fresh login", async () => {
      t = await authForge();
      const { body } = await signup(t.client);
      await login(t.newClient()); // second session

      const res = await t.client.patch("/account/me", { password: "Brand-new-pass-9", currentPassword: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/log in again/);
      expect(t.data.repository("User").dump()[0]!.password).toMatch(/^\$argon2id\$/);
      expect(refreshTokenRows(t)).toHaveLength(0);

      expect((await t.newClient().post("/auth/refresh-token", { refreshToken: body.refreshToken })).status).toBe(401);
      expect((await login(t.newClient())).status).toBe(401);
      expect((await login(t.newClient(), "ada@example.com", "Brand-new-pass-9")).status).toBe(200);
    });

    it("enforces the password rules", async () => {
      t = await authForge();
      await signup(t.client);
      const res = await t.client.patch("/account/me", { password: "short", currentPassword: PASSWORD });
      expect(res.status).toBe(422);
    });
  });

  it("deletes the account, its sessions and the cookies", async () => {
    t = await authForge();
    const { body } = await signup(t.client);
    const res = await t.client.delete("/account/me");
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("ada@example.com");
    expect(t.data.repository("User").dump()).toHaveLength(0);
    expect(refreshTokenRows(t)).toHaveLength(0);
    expect(t.client.cookies).toEqual({});
    expect((await t.newClient().post("/auth/refresh-token", { refreshToken: body.refreshToken })).status).toBe(401);
    expect((await login(t.newClient())).status).toBe(401);
  });
});

describe("admin", () => {
  it("lets administrators through", async () => {
    t = await authForge();
    const admin = await makeAdmin(t);
    const res = await admin.get("/admin/check");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ role: "admin", isAdmin: true });
  });

  it("rejects normal users with 403 ADMIN_REQUIRED and anonymous callers with 401", async () => {
    t = await authForge();
    await signup(t.client);
    const res = await t.client.get("/admin/check");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ADMIN_REQUIRED");
    expect((await t.newClient().get("/admin/check")).status).toBe(401);
  });

  it("honours custom admin roles (1.x hard-coded 'admin')", async () => {
    t = await authForge({}, { adminRoles: ["super_admin", "owner"] });
    const client = t.newClient();
    await signup(client);
    const user = (await t.data.repository("User").findOne({ email: "ada@example.com" }))!;

    await t.data.repository("User").updateById(user._id, { role: "admin" });
    expect((await client.get("/admin/check")).status).toBe(403);
    await t.data.repository("User").updateById(user._id, { role: "owner" });
    expect((await client.get("/admin/check")).status).toBe(200);
  });
});

describe("health", () => {
  it("reports ok on every verb", async () => {
    t = await authForge();
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      const res = await t.client.request(method, "/health");
      expect(res.status, method).toBe(200);
      expect(res.body.data).toMatchObject({ status: "ok", database: "up", method });
      expect(res.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns 503 when the database is down", async () => {
    t = await authForge();
    t.data.healthy = false;
    const res = await t.client.get("/health");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, data: { status: "degraded", database: "down" } });
  });

  it("does not require authentication", async () => {
    t = await authForge();
    expect((await t.newClient().get("/health")).status).toBe(200);
  });

  it("can be replaced by a user-defined health collection", async () => {
    t = await authForge({}, { collections: [{ type: "health", route: "health", routes: [{ method: "get", path: "/", handler: "healthGet", auth: "public" }] }] });
    expect((await t.client.get("/health")).status).toBe(200);
    expect((await t.client.post("/health")).status).toBe(404);
  });
});
