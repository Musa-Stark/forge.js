import { afterEach, describe, expect, it } from "vitest";
import sodium from "libsodium-wrappers-sumo";
import type { TestForge } from "../src/testing/index.js";
import { authForge, login, PASSWORD, refreshTokenRows, signup } from "./helpers.js";

let t: TestForge;
afterEach(() => t?.close());

describe("signup (credentials mode)", () => {
  it("creates the account, starts a session and never returns the password", async () => {
    t = await authForge();
    const res = await signup(t.client);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ name: "Ada", email: "ada@example.com", role: "user" });
    expect(res.body.data.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(res.body.refreshToken).toBeTypeOf("string");
  });

  it("stores an Argon2id hash, never the password", async () => {
    t = await authForge();
    await signup(t.client);
    const [stored] = t.data.repository("User").dump();
    expect(stored!.password).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(stored)).not.toContain(PASSWORD);
  });

  it("sets HttpOnly session cookies", async () => {
    t = await authForge();
    const res = await signup(t.client);
    const cookies = res.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    for (const c of cookies) {
      expect(c).toMatch(/HttpOnly/i);
      expect(c).toMatch(/SameSite=Lax/i);
    }
    expect(t.client.cookies).toHaveProperty("accessToken");
    expect(t.client.cookies).toHaveProperty("refreshToken");
  });

  it("adds the cookie Domain attribute when auth.cookie.domain is set", async () => {
    t = await authForge({ cookie: { domain: ".example.com" } });
    const res = await signup(t.client);
    for (const c of res.headers.getSetCookie()) expect(c).toMatch(/Domain=\.example\.com;/i);
  });

  it("keeps cookies host-only when no domain is configured", async () => {
    t = await authForge();
    const res = await signup(t.client);
    for (const c of res.headers.getSetCookie()) expect(c).not.toMatch(/Domain=/i);
  });

  it("omits tokens from the JSON body unless enabled", async () => {
    t = await authForge({ returnAccessToken: false, returnRefreshToken: false });
    const res = await signup(t.client);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    expect(t.client.cookies).toHaveProperty("accessToken");
  });

  it("ignores a role sent by the caller (privilege escalation)", async () => {
    t = await authForge();
    const res = await signup(t.client, "mallory@example.com", { role: "admin" });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe("user");
    const me = await t.client.get("/admin/check");
    expect(me.status).toBe(403);
  });

  it("rejects an e-mail that is already registered with 409 USER_ALREADY_EXISTS", async () => {
    t = await authForge();
    await signup(t.client);
    const res = await signup(t.newClient());
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("USER_ALREADY_EXISTS");
  });

  it("treats e-mails case-insensitively", async () => {
    t = await authForge();
    await signup(t.client, "ada@example.com");
    const res = await signup(t.newClient(), "ADA@Example.com");
    expect(res.status).toBe(409);
  });

  it.each([
    ["short password", { password: "short" }],
    ["very long password (hashing DoS)", { password: "a".repeat(5000) }],
    ["bad e-mail", { email: "not-an-email" }],
    ["missing name", { name: undefined }],
  ])("returns 422 with field issues for %s", async (_label, override) => {
    t = await authForge();
    const res = await t.client.post("/auth/signup", { name: "Ada", email: "ada@example.com", password: PASSWORD, ...override });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_FAILED");
    expect(res.body.issues.length).toBeGreaterThan(0);
  });

  it("is a 404, not a crash, for GET /auth/signup", async () => {
    t = await authForge();
    expect((await t.client.get("/auth/signup")).status).toBe(404);
  });
});

describe("login (credentials mode)", () => {
  it("logs in with the right password", async () => {
    t = await authForge();
    await signup(t.client);
    const client = t.newClient();
    const res = await login(client);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("ada@example.com");
    expect(client.cookies).toHaveProperty("refreshToken");
  });

  it("answers identically for a wrong password and an unknown e-mail (no user enumeration)", async () => {
    t = await authForge();
    await signup(t.client);
    const wrongPassword = await login(t.newClient(), "ada@example.com", "Wrong-password-1");
    const unknownUser = await login(t.newClient(), "ghost@example.com", "Wrong-password-1");

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.code).toBe("INVALID_CREDENTIALS");
    expect(unknownUser.body.code).toBe("INVALID_CREDENTIALS");
    expect(wrongPassword.body.message).toBe(unknownUser.body.message);
  });

  it("is not fooled by NoSQL operator injection", async () => {
    t = await authForge();
    await signup(t.client);
    const attack = await t.client.post("/auth/login", { email: { $ne: null }, password: { $ne: null } });
    expect(attack.status).toBe(422);
    const attack2 = await t.client.post("/auth/login", { email: "ada@example.com", password: { $gt: "" } });
    expect(attack2.status).toBe(422);
  });

  it("lets users with an old short password log in (login does not enforce the new minimum)", async () => {
    t = await authForge();
    await signup(t.client);
    const user = (await t.data.repository("User").findOne({ email: "ada@example.com" }))!;
    const { PasswordHasher } = await import("../src/security/PasswordHasher.js");
    await t.data.repository("User").updateById(user._id, { password: await new PasswordHasher().hash("abc123") });
    expect((await login(t.newClient(), "ada@example.com", "abc123")).status).toBe(200);
  });

  it("upgrades a Forge 1.x password hash after a successful login", async () => {
    t = await authForge();
    await signup(t.client);
    const users = t.data.repository("User");
    const user = (await users.findOne({ email: "ada@example.com" }))!;

    await sodium.ready;
    const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
    const raw = sodium.crypto_pwhash(32, PASSWORD, salt, sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE, sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE, sodium.crypto_pwhash_ALG_DEFAULT);
    await users.updateById(user._id, { password: `${sodium.to_base64(salt)}:${sodium.to_base64(raw)}` });

    expect((await login(t.newClient())).status).toBe(200);
    expect(users.dump()[0]!.password).toMatch(/^\$argon2id\$/);
    expect((await login(t.newClient())).status).toBe(200);
  });

  it("rejects an empty body with 422", async () => {
    t = await authForge();
    expect((await t.client.post("/auth/login", {})).status).toBe(422);
  });

  it("rejects malformed JSON with 400 INVALID_JSON", async () => {
    t = await authForge();
    const res = await t.client.post("/auth/login", "{not json", { headers: { "content-type": "application/json" } });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_JSON");
  });
});

describe("authentication guard", () => {
  it("accepts the access token from the Authorization header", async () => {
    t = await authForge();
    const { body } = await signup(t.client);
    const res = await t.newClient().get("/account/me", { headers: { authorization: `Bearer ${body.accessToken}` } });
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("ada@example.com");
  });

  it("accepts the access token from the cookie", async () => {
    t = await authForge();
    await signup(t.client);
    expect((await t.client.get("/account/me")).status).toBe(200);
  });

  it("returns 401 ACCESS_TOKEN_MISSING with no credentials", async () => {
    t = await authForge();
    const res = await t.client.get("/account/me");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("ACCESS_TOKEN_MISSING");
  });

  it("does not read the access token from the request body (1.x did)", async () => {
    t = await authForge();
    const { body } = await signup(t.client);
    const res = await t.newClient().request("GET", "/account/me", undefined, { headers: { "content-type": "application/json" } });
    expect(res.status).toBe(401);
    expect(body.accessToken).toBeTypeOf("string");
  });

  it("returns 401 ACCESS_TOKEN_INVALID for garbage", async () => {
    t = await authForge();
    const res = await t.client.get("/account/me", { headers: { authorization: "Bearer nonsense" } });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("ACCESS_TOKEN_INVALID");
  });

  it("refuses a refresh token used as an access token", async () => {
    t = await authForge();
    const { body } = await signup(t.client);
    const res = await t.newClient().get("/account/me", { headers: { authorization: `Bearer ${body.refreshToken}` } });
    expect(res.status).toBe(401);
  });

  it("returns 401 ACCESS_USER_NOT_FOUND once the account is gone", async () => {
    t = await authForge();
    const { body } = await signup(t.client);
    await t.data.repository("User").deleteMany({ email: "ada@example.com" });
    const res = await t.newClient().get("/account/me", { headers: { authorization: `Bearer ${body.accessToken}` } });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("ACCESS_USER_NOT_FOUND");
  });

  it("reflects a role change immediately", async () => {
    t = await authForge();
    await signup(t.client);
    expect((await t.client.get("/admin/check")).status).toBe(403);
    const user = (await t.data.repository("User").findOne({ email: "ada@example.com" }))!;
    await t.data.repository("User").updateById(user._id, { role: "admin" });
    expect((await t.client.get("/admin/check")).status).toBe(200);
  });
});

describe("refresh tokens and sessions", () => {
  it("stores only a hash of each refresh token", async () => {
    t = await authForge();
    const { body } = await signup(t.client);
    const rows = refreshTokenRows(t);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(body.refreshToken);
    expect(rows[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rotates the refresh token on every refresh", async () => {
    t = await authForge();
    const { body } = await signup(t.client);
    const res = await t.client.post("/auth/refresh-token");
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toBeTypeOf("string");
    expect(res.body.refreshToken).not.toBe(body.refreshToken);
    expect(refreshTokenRows(t)).toHaveLength(2);
    expect((await t.client.get("/account/me")).status).toBe(200);
  });

  it("accepts the refresh token in the body for non-cookie clients", async () => {
    t = await authForge();
    const { body } = await signup(t.client);
    const res = await t.newClient().post("/auth/refresh-token", { refreshToken: body.refreshToken });
    expect(res.status).toBe(200);
  });

  it("revokes the whole session family when a rotated token is replayed (theft detection)", async () => {
    t = await authForge({ refreshReuseGracePeriod: "0s" });
    const { body: first } = await signup(t.client);
    const stolen = first.refreshToken as string;

    const legit = await t.client.post("/auth/refresh-token");
    expect(legit.status).toBe(200);

    await new Promise((r) => setTimeout(r, 5));
    const replay = await t.newClient().post("/auth/refresh-token", { refreshToken: stolen });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe("REFRESH_TOKEN_REUSED");

    // The legitimate user's newest token is dead too.
    const after = await t.client.post("/auth/refresh-token");
    expect(after.status).toBe(401);
    expect(after.body.code).toBe("REFRESH_TOKEN_REVOKED");
  });

  it("tolerates two tabs refreshing at once (grace period) without killing the session", async () => {
    t = await authForge({ refreshReuseGracePeriod: "30s" });
    const { body } = await signup(t.client);
    await t.client.post("/auth/refresh-token");

    const second = await t.newClient().post("/auth/refresh-token", { refreshToken: body.refreshToken });
    expect(second.status).toBe(401);
    expect(second.body.code).toBe("REFRESH_TOKEN_ROTATED");
    expect((await t.client.post("/auth/refresh-token")).status).toBe(200);
  });

  it("does not rotate when rotation is disabled", async () => {
    t = await authForge({ rotateRefreshToken: false });
    await signup(t.client);
    const res = await t.client.post("/auth/refresh-token");
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toBeUndefined();
    expect(refreshTokenRows(t)).toHaveLength(1);
  });

  it("rejects an unknown or forged refresh token", async () => {
    t = await authForge();
    await signup(t.client);
    const res = await t.newClient().post("/auth/refresh-token", { refreshToken: "forged.token.value" });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("REFRESH_TOKEN_INVALID");
    const none = await t.newClient().post("/auth/refresh-token");
    expect(none.body.code).toBe("REFRESH_TOKEN_MISSING");
  });

  it("rejects a non-string refresh token without crashing", async () => {
    t = await authForge();
    const res = await t.client.post("/auth/refresh-token", { refreshToken: { $ne: 1 } });
    expect(res.status).toBe(401);
  });

  it("rejects a token whose database record is gone", async () => {
    t = await authForge();
    await signup(t.client);
    await t.data.repository("ForgeRefreshToken").deleteMany({});
    const res = await t.client.post("/auth/refresh-token");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("REFRESH_TOKEN_NOT_FOUND");
  });

  it("rejects a refresh token whose record has expired", async () => {
    t = await authForge();
    await signup(t.client);
    const [row] = refreshTokenRows(t);
    await t.data.repository("ForgeRefreshToken").updateById(row!._id, { expiresAt: new Date(Date.now() - 1000) });
    const res = await t.client.post("/auth/refresh-token");
    expect(res.body.code).toBe("REFRESH_TOKEN_EXPIRED");
  });

  it("refuses to refresh for a deleted account and closes the session", async () => {
    t = await authForge();
    await signup(t.client);
    await t.data.repository("User").deleteMany({ email: "ada@example.com" });
    const res = await t.client.post("/auth/refresh-token");
    expect(res.body.code).toBe("REFRESH_USER_NOT_FOUND");
  });

  it("logout revokes the session and clears the cookies", async () => {
    t = await authForge();
    const { body } = await signup(t.client);
    const res = await t.client.post("/auth/logout");
    expect(res.status).toBe(200);
    expect(t.client.cookies).toEqual({});

    const replay = await t.newClient().post("/auth/refresh-token", { refreshToken: body.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe("REFRESH_TOKEN_REVOKED");
  });

  it("logout works even when the access token already expired, and when logged out twice", async () => {
    t = await authForge();
    const res1 = await t.newClient().post("/auth/logout");
    expect(res1.status).toBe(200);
    await signup(t.client);
    expect((await t.client.post("/auth/logout")).status).toBe(200);
    expect((await t.client.post("/auth/logout")).status).toBe(200);
  });

  it("no longer exposes state-changing GET logout/refresh (CSRF)", async () => {
    t = await authForge();
    expect((await t.client.get("/auth/logout")).status).toBe(404);
    expect((await t.client.get("/auth/refresh-token")).status).toBe(404);
  });
});
