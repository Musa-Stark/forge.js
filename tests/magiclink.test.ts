import { afterEach, describe, expect, it } from "vitest";
import { ForgeConfig } from "../src/config/ForgeConfig.js";
import { MAGIC_LINK_MODEL, MFA_FACTOR_MODEL } from "../src/data/internalModels.js";
import { Totp } from "../src/security/Totp.js";
import { sha256 } from "../src/security/TokenService.js";
import { testAuthConfig, TEST_JWT_SECRET, type TestClient, type TestForge } from "../src/testing/index.js";
import { authForge, login, PASSWORD, signup } from "./helpers.js";

let t: TestForge | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
});

const URL_BASE = "https://app.example.com/auth/magic";
const magicForge = (magic: Record<string, unknown> = {}, auth: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  authForge({ magicLink: { url: URL_BASE, ...magic }, ...auth }, { frontendURL: "https://app.example.com", ...extra });

const request = (client: TestClient, email = "ada@example.com", extra: Record<string, unknown> = {}) => client.post("/auth/magic-link", { email, ...extra });
const verify = (client: TestClient, token: string) => client.post("/auth/magic-link/verify", { token });
const links = () => t!.data.repository(MAGIC_LINK_MODEL).dump();
const users = () => t!.data.repository("User").dump();
const seedUser = (email = "ada@example.com") => t!.data.repository("User").create({ name: "Local Ada", email, password: "x".repeat(10) });

/** Asks for a link and returns the client that asked plus the token from the e-mail. */
const asked = async (email = "ada@example.com", extra: Record<string, unknown> = {}) => {
  const client = t!.newClient();
  await request(client, email, extra);
  return { client, token: t!.email.lastMagicToken(email) };
};

describe("requesting a link", () => {
  it("answers identically whether or not the address has an account (no enumeration)", async () => {
    t = await magicForge();
    await seedUser("known@example.com");
    const known = await request(t.newClient(), "known@example.com");
    const unknown = await request(t.newClient(), "stranger@example.com");
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(known.body.message).toMatch(/If this address can sign in/);
  });

  it("answers the same, cookie included, even when nothing is sent (signup disallowed)", async () => {
    t = await magicForge({ allowSignup: false });
    await seedUser("known@example.com");
    const known = await request(t.newClient(), "known@example.com");
    const unknown = await request(t.newClient(), "stranger@example.com");
    expect(unknown.body).toEqual(known.body);
    for (const res of [known, unknown]) expect(res.headers.getSetCookie().some((c) => c.startsWith("forge_magic_binding="))).toBe(true);
    expect(t.email.sent.map((e) => e.to)).toEqual(["known@example.com"]);
    expect(links()).toHaveLength(1);
  });

  it("e-mails a link to the front-end page with a high-entropy token", async () => {
    t = await magicForge();
    await request(t.client);
    const mail = t.email.lastTo("ada@example.com")!;
    expect(mail.subject).toBe("Your sign-in link");
    expect(mail.from).toBe("Forge Tests <noreply@forge.test>");
    const token = t.email.lastMagicToken("ada@example.com");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mail.html).toContain(`${URL_BASE}?token=${token}`);
  });

  it("stores only a hash of the token, and a hash of the browser binding", async () => {
    t = await magicForge();
    const { client, token } = await asked();
    const dump = JSON.stringify(links());
    expect(dump).not.toContain(token);
    expect(dump).not.toContain(client.cookies.forge_magic_binding);
    expect(links()[0]).toMatchObject({ email: "ada@example.com", tokenHash: sha256(token), bindingHash: sha256(client.cookies.forge_magic_binding!) });
  });

  it("sets the browser-binding cookie as HttpOnly", async () => {
    t = await magicForge();
    const res = await request(t.client);
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("forge_magic_binding="))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Max-Age=900/i);
  });

  it("normalises the address", async () => {
    t = await magicForge();
    await request(t.client, "  ADA@Example.COM ".trim());
    expect(t.email.sent[0]!.to).toBe("ada@example.com");
    expect(links()[0]!.email).toBe("ada@example.com");
  });

  it("does not flood an inbox: a second request inside the cooldown sends nothing and keeps the first link valid", async () => {
    t = await magicForge();
    const { client, token } = await asked();
    const again = await request(client);
    expect(again.status).toBe(200);
    expect(t.email.sent).toHaveLength(1);
    expect(links()).toHaveLength(1);
    expect((await verify(client, token)).status).toBe(201);
  });

  it("asking again keeps the browser's binding, so the link already in the inbox still works", async () => {
    t = await magicForge();
    const { client, token } = await asked();
    const before = client.cookies.forge_magic_binding;
    await request(client);
    expect(client.cookies.forge_magic_binding).toBe(before);
    expect((await verify(client, token)).status).toBe(201);
  });

  it("another browser asking during the cooldown sends nothing and cannot use the first link", async () => {
    t = await magicForge();
    const first = await asked();
    const other = t.newClient();
    await request(other);
    expect(t.email.sent).toHaveLength(1);
    expect((await verify(other, first.token)).body.code).toBe("MAGIC_LINK_DEVICE_MISMATCH");
    expect((await verify(first.client, first.token)).status).toBe(201);
  });

  it("ignores a malformed binding cookie instead of trusting it", async () => {
    t = await magicForge();
    const client = t.newClient();
    client.setCookie("forge_magic_binding", "x");
    await request(client);
    expect(client.cookies.forge_magic_binding).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("after the cooldown a new link replaces the old one", async () => {
    t = await magicForge({ resendCooldown: "0s" });
    const first = await asked();
    const client = t.newClient();
    await request(client);
    const second = t.email.lastMagicToken("ada@example.com");
    expect(second).not.toBe(first.token);
    expect(t.email.sent).toHaveLength(2);
    expect(links()).toHaveLength(1);
    expect((await verify(first.client, first.token)).body.code).toBe("MAGIC_LINK_INVALID");
    expect((await verify(client, second)).status).toBe(201);
  });

  it("does not reveal e-mail provider failures (they would only happen for real recipients)", async () => {
    t = await magicForge();
    t.email.failNext = true;
    const res = await request(t.client);
    expect(res.status).toBe(200);
    expect(t.email.sent).toHaveLength(0);
  });

  it("escapes a display name before it reaches the e-mail", async () => {
    t = await magicForge();
    await request(t.client, "new@example.com", { name: '<img src=x onerror=alert(1)>' });
    const html = t.email.lastTo("new@example.com")!.html;
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it.each([{}, { email: "nope" }, { email: ["a@b.co"] }, { email: { $ne: null } }, { email: "a@b.co", name: "x".repeat(101) }, { email: "a@b.co", name: { $gt: "" } }])("validates the body %j", async (body) => {
    t = await magicForge();
    expect((await t.client.post("/auth/magic-link", body)).status).toBe(422);
    expect(t.email.sent).toHaveLength(0);
  });

  it("is limited by the strict credential limiter (it sends e-mail)", async () => {
    t = await magicForge({}, {}, { authMaxReqLimit: 3 });
    for (let i = 0; i < 3; i++) expect((await request(t.client, `u${i}@example.com`)).status).toBe(200);
    expect((await request(t.client, "u9@example.com")).status).toBe(429);
  });

  it("is not registered unless configured", async () => {
    t = await authForge();
    expect((await request(t.client)).status).toBe(404);
    expect((await t.client.post("/auth/magic-link/verify", { token: "x".repeat(43) })).status).toBe(404);
  });
});

describe("redeeming a link", () => {
  it("creates the account on first use and starts a session", async () => {
    t = await magicForge();
    const { client, token } = await asked("new@example.com", { name: "Nia" });
    const res = await verify(client, token);
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.body.message).toBe("Signed in successfully.");
    expect(res.body.data).toMatchObject({ email: "new@example.com", name: "Nia", role: "user" });
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(client.cookies).toHaveProperty("accessToken");
    expect(client.cookies.forge_magic_binding).toBeUndefined();
    expect((await client.get("/account/me")).body.data.email).toBe("new@example.com");
    expect(users()).toHaveLength(1);
  });

  it("falls back to the address's local part when no name was given", async () => {
    t = await magicForge();
    const { client, token } = await asked("kim@example.com");
    expect((await verify(client, token)).body.data.name).toBe("kim");
  });

  it("gives magic-link users an unusable password and never grants roles", async () => {
    t = await magicForge();
    const { client, token } = await asked();
    await verify(client, token);
    expect(users()[0]!.password).toMatch(/^\$argon2id\$/);
    expect((await login(t.newClient(), "ada@example.com", "anything-at-all-1")).status).toBe(401);
    expect(users()[0]!.role).toBe("user");
  });

  it("signs in an existing account when sign-up verifies e-mails", async () => {
    t = await magicForge({}, { signupMode: "otp" });
    const existing = await seedUser();
    const { client, token } = await asked();
    const res = await verify(client, token);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(existing._id);
    expect(users()).toHaveLength(1);
  });

  it("works once only (single use)", async () => {
    t = await magicForge();
    const { client, token } = await asked();
    expect((await verify(client, token)).status).toBe(201);
    const again = await verify(client, token);
    expect(again.status).toBe(400);
    expect(again.body.code).toBe("MAGIC_LINK_INVALID");
    expect(links()).toHaveLength(0);
  });

  it("two simultaneous redemptions: exactly one wins", async () => {
    t = await magicForge();
    const { client: a, token } = await asked();
    const b = t.newClient();
    b.setCookie("forge_magic_binding", a.cookies.forge_magic_binding!);
    const results = await Promise.all([verify(a, token), verify(b, token)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(users()).toHaveLength(1);
  });

  it("refuses an expired link and cleans it up", async () => {
    t = await magicForge();
    const { client, token } = await asked();
    await t.data.repository(MAGIC_LINK_MODEL).updateById(links()[0]!._id, { expiresAt: new Date(Date.now() - 1000) });
    const res = await verify(client, token);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MAGIC_LINK_INVALID");
    expect(links()).toHaveLength(0);
    expect(users()).toHaveLength(0);
  });

  it("gives expired, used and invented links exactly the same answer", async () => {
    t = await magicForge();
    const { client, token } = await asked();
    await verify(client, token);
    const used = await verify(client, token);
    const invented = await verify(client, "A".repeat(43));
    expect(invented.status).toBe(used.status);
    expect(invented.body.code).toBe(used.body.code);
    expect(invented.body.message).toBe(used.body.message);
  });

  it.each([{}, { token: "short" }, { token: 12345 }, { token: { $ne: 1 } }, { token: ["a".repeat(43)] }, { token: "a".repeat(500) }])("rejects the malformed body %j", async (body) => {
    t = await magicForge();
    expect((await t.client.post("/auth/magic-link/verify", body)).status).toBe(422);
  });

  it("cannot be redeemed with GET: mail scanners that prefetch links sign nobody in and burn nothing", async () => {
    t = await magicForge();
    const { client, token } = await asked();
    expect((await client.get(`/auth/magic-link/verify?token=${token}`)).status).toBe(404);
    expect(links()).toHaveLength(1);
    expect((await verify(client, token)).status).toBe(201);
  });

  it("the token is not accepted as any other credential", async () => {
    t = await magicForge();
    const { client, token } = await asked();
    expect((await client.get("/account/me", { headers: { authorization: `Bearer ${token}` } })).status).toBe(401);
    expect((await client.post("/auth/refresh-token", { refreshToken: token })).status).toBe(401);
  });
});

describe("tying the link to the browser (login CSRF)", () => {
  it("refuses another browser, and does not burn the link", async () => {
    t = await magicForge();
    const { client, token } = await asked();
    const stranger = t.newClient();
    const res = await verify(stranger, token);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MAGIC_LINK_DEVICE_MISMATCH");
    expect(stranger.cookies).toEqual({});
    expect(links()).toHaveLength(1);
    expect((await verify(client, token)).status).toBe(201);
  });

  it("an attacker cannot sign a victim in to the attacker's account by mailing them the attacker's own link", async () => {
    t = await magicForge();
    // The attacker asks for a link for an account they control, in their own browser...
    const attacker = await asked("attacker@example.com");
    // ...and gets the victim to open it. The victim's browser never asked for it.
    const victim = t.newClient();
    await request(victim, "victim@example.com");
    const res = await verify(victim, attacker.token);
    expect(res.body.code).toBe("MAGIC_LINK_DEVICE_MISMATCH");
    expect(victim.cookies).not.toHaveProperty("accessToken");
    expect(users()).toHaveLength(0);
  });

  it("rejects a wrong or tampered cookie value", async () => {
    t = await magicForge();
    const { client, token } = await asked();
    client.setCookie("forge_magic_binding", client.cookies.forge_magic_binding + "x");
    expect((await verify(client, token)).body.code).toBe("MAGIC_LINK_DEVICE_MISMATCH");
  });

  it("can be switched off for cross-device or mobile use", async () => {
    t = await magicForge({ sameDevice: false });
    const { token } = await asked();
    expect(links()[0]!.bindingHash).toBeNull();
    expect((await verify(t.newClient(), token)).status).toBe(201);
  });
});

describe("existing accounts and the linking policy", () => {
  it("'auto' refuses to sign in to an account whose e-mail was never verified (pre-hijacking)", async () => {
    t = await magicForge({}, { signupMode: "credentials" });
    // The attacker registered the victim's address with a password only they know.
    await t.newClient().post("/auth/signup", { name: "Mallory", email: "ada@example.com", password: PASSWORD });

    const { client, token } = await asked();
    const res = await verify(client, token);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ACCOUNT_LINK_BLOCKED");
    expect(client.cookies).not.toHaveProperty("accessToken");
    expect(users()).toHaveLength(1);
    expect(users()[0]!.name).toBe("Mallory");
  });

  it("'always' signs in anyway", async () => {
    t = await magicForge({ accountLinking: "always" }, { signupMode: "credentials" });
    const existing = await seedUser();
    const { client, token } = await asked();
    const res = await verify(client, token);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(existing._id);
  });

  it("'never' refuses even verified accounts, with a hint", async () => {
    t = await magicForge({ accountLinking: "never" }, { signupMode: "otp" });
    await seedUser();
    const { client, token } = await asked();
    const res = await verify(client, token);
    expect(res.status).toBe(409);
    expect(res.body.hint).toMatch(/never/);
  });

  it("new addresses are always fine, whatever the policy", async () => {
    t = await magicForge({ accountLinking: "never" });
    const { client, token } = await asked("fresh@example.com");
    expect((await verify(client, token)).status).toBe(201);
  });
});

describe("together with two-factor", () => {
  it("a magic-link sign-in still needs the authenticator code", async () => {
    t = await magicForge({}, { mfa: { issuer: "Acme" }, signupMode: "otp" });
    // Create the user and turn two-factor on.
    const first = await asked();
    await verify(first.client, first.token);
    const totp = new Totp();
    const secret = (await first.client.post("/auth/mfa/totp/setup")).body.data.secret as string;
    expect((await first.client.post("/auth/mfa/totp/enable", { code: totp.codeAt(secret) })).status).toBe(200);
    await first.client.post("/auth/logout");
    await t.data.repository(MFA_FACTOR_MODEL).updateMany({}, { lastUsedStep: -1 });

    // Second sign-in by link.
    t.email.sent.length = 0;
    const second = t.newClient();
    await t.data.repository(MAGIC_LINK_MODEL).deleteMany({});
    await request(second);
    const res = await verify(second, t.email.lastMagicToken("ada@example.com"));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ mfaRequired: true });
    expect(res.body.data).toBeUndefined();
    expect(second.cookies).not.toHaveProperty("accessToken");

    const done = await second.post("/auth/mfa/verify", { mfaToken: res.body.mfaToken, code: totp.codeAt(secret) });
    expect(done.status).toBe(200);
    expect(second.cookies).toHaveProperty("accessToken");
  });
});

describe("housekeeping", () => {
  it("deleting an account removes its pending links", async () => {
    t = await magicForge();
    const { client, token } = await asked();
    await verify(client, token);
    await request(t.newClient()); // a new pending link for the same address
    expect(links()).toHaveLength(1);
    await client.delete("/account/me");
    expect(links()).toHaveLength(0);
  });

  it("is listed by GET /auth/methods", async () => {
    t = await magicForge({ sameDevice: false, allowSignup: false });
    expect((await t.client.get("/auth/methods")).body.data.magicLink).toEqual({ sameDevice: false, allowSignup: false });
  });
});

describe("configuration", () => {
  const problems = (fn: () => unknown): string => {
    try { fn(); } catch (e) { return ((e as any).details.problems as string[]).join("\n"); }
    throw new Error("expected a ConfigurationError");
  };
  const cfg = (magicLink: unknown, extra: Record<string, unknown> = {}) =>
    () => new ForgeConfig({ ENV: "test", jwtSecret: TEST_JWT_SECRET, frontendURL: "https://app.example.com", builtinConfig: { auth: testAuthConfig({ magicLink }) as never }, ...extra });

  it("accepts a minimal setup and applies defaults", () => {
    const config = cfg({ url: URL_BASE })();
    expect(config.auth.magicLink).toMatchObject({ allowSignup: true, sameDevice: true, accountLinking: "auto" });
    expect(config.auth.magicLink!.expiresIn.toMs()).toBe(900_000);
    expect(config.auth.magicLink!.resendCooldown.toMs()).toBe(60_000);
    expect(new ForgeConfig({ ENV: "test" }).auth.magicLink).toBeUndefined();
  });

  it("only links to a configured front-end (the link is e-mailed, so it must not point elsewhere)", () => {
    expect(problems(cfg({ url: "https://evil.example/steal" }))).toMatch(/not on a configured front-end/);
    expect(problems(cfg({ url: "/relative" }))).toMatch(/absolute/);
    expect(problems(cfg({ url: "javascript:alert(1)" }))).toMatch(/absolute|front-end/);
    expect(problems(cfg({ url: URL_BASE }, { frontendURL: undefined }))).toMatch(/not on a configured front-end/);
  });

  it("validates the policy and durations", () => {
    expect(problems(cfg({ url: URL_BASE, accountLinking: "maybe" }))).toMatch(/accountLinking/);
    expect(problems(cfg({ url: URL_BASE, expiresIn: "later" }))).toMatch(/expiresIn/);
    expect(problems(cfg({ url: URL_BASE, resendCooldown: "x" }))).toMatch(/resendCooldown/);
  });

  it("needs real e-mail delivery when not offline", () => {
    const msg = problems(cfg({ url: URL_BASE }, { isOffline: false, mongoDBURI: "mongodb://x" }));
    expect(msg).toMatch(/resendAPIKey is required for magic links/);
    expect(msg).toMatch(/systemEmailSender is required for magic links/);
  });
});
