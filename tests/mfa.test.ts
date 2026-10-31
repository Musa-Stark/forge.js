import { afterEach, describe, expect, it } from "vitest";
import { ForgeConfig } from "../src/config/ForgeConfig.js";
import { Totp } from "../src/security/Totp.js";
import { TokenService } from "../src/security/TokenService.js";
import { MFA_FACTOR_MODEL, OAUTH_IDENTITY_MODEL, MAGIC_LINK_MODEL } from "../src/data/internalModels.js";
import { Duration } from "../src/config/Duration.js";
import { testAuthConfig, TEST_JWT_SECRET, type TestClient, type TestForge } from "../src/testing/index.js";
import { authForge, login, PASSWORD, refreshTokenRows, signup } from "./helpers.js";

let t: TestForge | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
});

const totp = new Totp();
const mfaForge = (mfa: Record<string, unknown> = {}, auth: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  authForge({ mfa: { issuer: "Acme", ...mfa }, ...auth }, extra);

const factor = () => t!.data.repository(MFA_FACTOR_MODEL).dump()[0]!;
const wrongCodeFor = (secret: string) => {
  const real = totp.codeAt(secret);
  return real === "000000" ? "000001" : "000000";
};

/**
 * A code is accepted once per 30-second step, so right after activation the *current* step is spent.
 * Simulate "the user comes back later" by forgetting which step was last used.
 */
const rewind = () => t!.data.repository(MFA_FACTOR_MODEL).updateMany({}, { lastUsedStep: -1 });

/** Signs up, turns on two-factor, and returns everything a test needs. */
const enroll = async (email = "ada@example.com") => {
  const client = t!.newClient();
  await signup(client, email);
  const setup = await client.post("/auth/mfa/totp/setup");
  const secret = setup.body.data.secret as string;
  const enable = await client.post("/auth/mfa/totp/enable", { code: totp.codeAt(secret) });
  await client.post("/auth/logout");
  await rewind();
  return { client, secret, setup, enable, recoveryCodes: enable.body.data.recoveryCodes as string[], email };
};

/** First step of a sign-in with two-factor on. */
const firstStep = async (client: TestClient, email = "ada@example.com") => (await login(client, email)).body as { mfaRequired: boolean; mfaToken: string };
/** A code that is valid *now* and later than anything used before. */
const nextCode = (secret: string, stepsAhead = 0) => totp.codeAt(secret, Date.now() + stepsAhead * 30_000);

describe("enrolment", () => {
  it("requires authentication", async () => {
    t = await mfaForge();
    for (const [method, path] of [["GET", "/auth/mfa"], ["POST", "/auth/mfa/totp/setup"], ["POST", "/auth/mfa/totp/enable"], ["POST", "/auth/mfa/disable"], ["POST", "/auth/mfa/recovery-codes"]] as const) {
      expect((await t.client.request(method, path, method === "POST" ? {} : undefined)).status, path).toBe(401);
    }
  });

  it("returns the secret and an otpauth URL, uncached", async () => {
    t = await mfaForge();
    await signup(t.client);
    const res = await t.client.post("/auth/mfa/totp/setup");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.body.data.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(res.body.data.issuer).toBe("Acme");
    const url = new URL(res.body.data.otpauthUrl);
    expect(url.searchParams.get("secret")).toBe(res.body.data.secret);
    expect(decodeURIComponent(url.pathname)).toBe("/Acme:ada@example.com");
  });

  it("encrypts the secret at rest: the database never holds it in the clear", async () => {
    t = await mfaForge();
    await signup(t.client);
    const { secret } = (await t.client.post("/auth/mfa/totp/setup")).body.data;
    const stored = factor();
    expect(JSON.stringify(stored)).not.toContain(secret);
    expect(stored.pendingSecret).toMatchObject({ str: expect.any(String), securedPrivateKey: expect.any(String) });
    expect(stored.enabled).toBe(false);
  });

  it("does not protect the account until the first code is confirmed", async () => {
    t = await mfaForge();
    await signup(t.client);
    await t.client.post("/auth/mfa/totp/setup");
    await t.client.post("/auth/logout");
    const res = await login(t.newClient());
    expect(res.status).toBe(200);
    expect(res.body.mfaRequired).toBeUndefined();
    expect(res.body.data.email).toBe("ada@example.com");
  });

  it("activates with a valid code and returns ten formatted recovery codes, once", async () => {
    t = await mfaForge();
    await signup(t.client);
    const { secret } = (await t.client.post("/auth/mfa/totp/setup")).body.data;
    const res = await t.client.post("/auth/mfa/totp/enable", { code: totp.codeAt(secret) });
    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(true);
    expect(res.body.data.recoveryCodes).toHaveLength(10);
    expect(new Set(res.body.data.recoveryCodes).size).toBe(10);
    for (const code of res.body.data.recoveryCodes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await t.client.get("/auth/mfa")).body.data).toEqual({ enabled: true, recoveryCodesRemaining: 10 });
  });

  it("stores only hashes of the recovery codes", async () => {
    t = await mfaForge();
    const { recoveryCodes } = await enroll();
    const dump = JSON.stringify(factor());
    for (const code of recoveryCodes) {
      expect(dump).not.toContain(code);
      expect(dump).not.toContain(code.replace(/-/g, ""));
    }
    expect(factor().recoveryCodeHashes).toHaveLength(10);
    expect(factor().recoveryCodeHashes[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never exposes the secret again after setup (status, login, profile)", async () => {
    t = await mfaForge();
    const { secret, client } = await enroll();
    const dump = [JSON.stringify((await login(client)).body), JSON.stringify((await client.get("/auth/mfa")).body)].join();
    expect(dump).not.toContain(secret);
  });

  it("refuses a wrong confirmation code with the attempts left", async () => {
    t = await mfaForge();
    await signup(t.client);
    const { secret } = (await t.client.post("/auth/mfa/totp/setup")).body.data;
    const res = await t.client.post("/auth/mfa/totp/enable", { code: wrongCodeFor(secret) });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("MFA_CODE_INVALID");
    expect(res.body.details.attemptsLeft).toBe(4);
    expect(factor().enabled).toBe(false);
  });

  it("refuses to activate without a setup (400) and to set up twice once active (409)", async () => {
    t = await mfaForge();
    await signup(t.client);
    const early = await t.client.post("/auth/mfa/totp/enable", { code: "123456" });
    expect(early.status).toBe(400);
    expect(early.body.code).toBe("MFA_SETUP_REQUIRED");

    const { secret } = (await t.client.post("/auth/mfa/totp/setup")).body.data;
    await t.client.post("/auth/mfa/totp/enable", { code: totp.codeAt(secret) });
    const again = await t.client.post("/auth/mfa/totp/setup");
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("MFA_ALREADY_ENABLED");

    // Confirming a second time says what is wrong instead of asking to start the setup.
    const confirmAgain = await t.client.post("/auth/mfa/totp/enable", { code: totp.codeAt(secret) });
    expect(confirmAgain.status).toBe(409);
    expect(confirmAgain.body.code).toBe("MFA_ALREADY_ENABLED");
    expect(confirmAgain.body.message).toBe("Two-factor authentication is already enabled.");
  });

  it("lets a user restart an unfinished setup: the newest secret wins", async () => {
    t = await mfaForge();
    await signup(t.client);
    const first = (await t.client.post("/auth/mfa/totp/setup")).body.data.secret;
    const second = (await t.client.post("/auth/mfa/totp/setup")).body.data.secret;
    expect(second).not.toBe(first);
    expect((await t.client.post("/auth/mfa/totp/enable", { code: wrongCodeFor(second) })).status).toBe(401);
    expect((await t.client.post("/auth/mfa/totp/enable", { code: totp.codeAt(second) })).status).toBe(200);
  });

  it.each([{}, { code: "" }, { code: "12" }, { code: 123456 }, { code: ["1", "2"] }, { code: { $ne: 1 } }])("validates the confirmation body %j", async (body) => {
    t = await mfaForge();
    await signup(t.client);
    expect((await t.client.post("/auth/mfa/totp/enable", body)).status).toBe(422);
  });

  it("is not registered unless configured", async () => {
    t = await authForge();
    await signup(t.client);
    expect((await t.client.post("/auth/mfa/totp/setup")).status).toBe(404);
    expect((await t.client.get("/auth/mfa")).status).toBe(404);
  });
});

describe("signing in with two-factor on", () => {
  it("password login stops at the second step: no session, no cookies, no tokens", async () => {
    t = await mfaForge();
    await enroll();
    const client = t.newClient();
    const sessionsBefore = refreshTokenRows(t).length;
    const res = await login(client);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, mfaRequired: true });
    expect(res.body.mfaToken).toBeTypeOf("string");
    expect(res.body.data).toBeUndefined();
    expect(res.body.accessToken).toBeUndefined();
    expect(client.cookies).toEqual({});
    expect((await client.get("/account/me")).status).toBe(401);
    expect(refreshTokenRows(t)).toHaveLength(sessionsBefore); // nothing was issued
  });

  it("completes with a valid authenticator code", async () => {
    t = await mfaForge();
    const { secret } = await enroll();
    const client = t.newClient();
    const { mfaToken } = await firstStep(client);
    const res = await client.post("/auth/mfa/verify", { mfaToken, code: nextCode(secret) });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.body.data).toMatchObject({ email: "ada@example.com" });
    expect(res.body.data.password).toBeUndefined();
    expect(client.cookies).toHaveProperty("accessToken");
    expect((await client.get("/account/me")).status).toBe(200);
  });

  it("is public: the second step happens before any session exists", async () => {
    t = await mfaForge();
    const { secret } = await enroll();
    const { mfaToken } = await firstStep(t.newClient());
    expect((await t.newClient().post("/auth/mfa/verify", { mfaToken, code: nextCode(secret) })).status).toBe(200);
  });

  it("rejects wrong codes without starting a session", async () => {
    t = await mfaForge();
    const { secret } = await enroll();
    const client = t.newClient();
    const { mfaToken } = await firstStep(client);
    const res = await client.post("/auth/mfa/verify", { mfaToken, code: wrongCodeFor(secret) });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("MFA_CODE_INVALID");
    expect(client.cookies).toEqual({});
  });

  it("a code works only once: replaying it is refused (replay protection)", async () => {
    t = await mfaForge();
    const { secret } = await enroll();
    const code = nextCode(secret);

    const a = t.newClient();
    expect((await a.post("/auth/mfa/verify", { mfaToken: (await firstStep(a)).mfaToken, code })).status).toBe(200);

    const b = t.newClient();
    const replay = await b.post("/auth/mfa/verify", { mfaToken: (await firstStep(b)).mfaToken, code });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe("MFA_CODE_INVALID");
    expect(b.cookies).toEqual({});

    // The next time step is fine.
    expect((await b.post("/auth/mfa/verify", { mfaToken: (await firstStep(b)).mfaToken, code: nextCode(secret, 1) })).status).toBe(200);
  });

  it("the code that activated two-factor cannot be used for the first sign-in either", async () => {
    t = await mfaForge();
    const e = await enroll();
    await t.data.repository(MFA_FACTOR_MODEL).updateMany({}, { lastUsedStep: totp.stepAt(Date.now()) }); // as if just used
    const client = t.newClient();
    const res = await client.post("/auth/mfa/verify", { mfaToken: (await firstStep(client)).mfaToken, code: nextCode(e.secret) });
    expect(res.status).toBe(401);
  });

  it("two simultaneous attempts with the same code: exactly one wins", async () => {
    t = await mfaForge();
    const { secret } = await enroll();
    const [a, b] = [t.newClient(), t.newClient()];
    const [ta, tb] = [(await firstStep(a)).mfaToken, (await firstStep(b)).mfaToken];
    const code = nextCode(secret);
    const results = await Promise.all([a.post("/auth/mfa/verify", { mfaToken: ta, code }), b.post("/auth/mfa/verify", { mfaToken: tb, code })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it("the challenge token is not a session and cannot be forged", async () => {
    t = await mfaForge();
    const { secret } = await enroll();
    const client = t.newClient();
    const { mfaToken } = await firstStep(client);

    expect((await client.get("/account/me", { headers: { authorization: `Bearer ${mfaToken}` } })).status).toBe(401);
    for (const bad of ["garbage".padEnd(40, "x"), "x".repeat(30), mfaToken.slice(0, -4) + "AAAA"]) {
      const res = await client.post("/auth/mfa/verify", { mfaToken: bad, code: nextCode(secret) });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("MFA_CHALLENGE_INVALID");
    }
    // An access or refresh token is not a challenge.
    const tokens = new TokenService(TEST_JWT_SECRET);
    // Genuinely signed tokens of the wrong type.
    const access = tokens.signAccess("someone", Duration.parse("5m"));
    const refresh = tokens.signRefresh({ sub: "someone", jti: "j", fam: "f" }, Duration.parse("5m"));
    for (const wrongType of [access, refresh]) {
      expect(wrongType.length).toBeGreaterThan(20);
      expect((await client.post("/auth/mfa/verify", { mfaToken: wrongType, code: nextCode(secret) })).body.code).toBe("MFA_CHALLENGE_INVALID");
    }
  });

  it("the challenge expires", async () => {
    t = await mfaForge({ challengeAge: "1s" });
    const { secret } = await enroll();
    const client = t.newClient();
    const { mfaToken } = await firstStep(client);
    await new Promise((r) => setTimeout(r, 1300));
    const res = await client.post("/auth/mfa/verify", { mfaToken, code: nextCode(secret) });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("MFA_CHALLENGE_INVALID");
  }, 10_000);

  it("a challenge for one user cannot be completed with another user's code", async () => {
    t = await mfaForge();
    await enroll("ada@example.com");
    const bob = await enroll("bob@example.com");
    const client = t.newClient();
    const { mfaToken } = await firstStep(client, "ada@example.com");
    const res = await client.post("/auth/mfa/verify", { mfaToken, code: nextCode(bob.secret) });
    expect(res.status).toBe(401);
    expect(client.cookies).toEqual({});
  });

  it("requires exactly one of code / recoveryCode", async () => {
    t = await mfaForge();
    const { secret, recoveryCodes } = await enroll();
    const client = t.newClient();
    const { mfaToken } = await firstStep(client);
    expect((await client.post("/auth/mfa/verify", { mfaToken })).status).toBe(422);
    expect((await client.post("/auth/mfa/verify", { mfaToken, code: nextCode(secret), recoveryCode: recoveryCodes[0] })).status).toBe(422);
    expect((await client.post("/auth/mfa/verify", { mfaToken, code: { $ne: 1 } })).status).toBe(422);
  });

  it("also guards the e-mailed-code login mode", async () => {
    t = await mfaForge({}, { signupMode: "credentials", loginMode: "otp" });
    const { secret } = await enroll();
    await t.newClient().post("/auth/login", { email: "ada@example.com", password: PASSWORD });
    const client = t.newClient();
    const res = await client.post("/auth/verify-otp", { email: "ada@example.com", otp: t.email.lastCode("ada@example.com"), purpose: "login" });
    expect(res.body).toMatchObject({ mfaRequired: true });
    expect(client.cookies).toEqual({});
    expect((await client.post("/auth/mfa/verify", { mfaToken: res.body.mfaToken, code: nextCode(secret) })).status).toBe(200);
  });

  it("does not interfere with sign-up, or with users who never enabled it", async () => {
    t = await mfaForge();
    const res = await signup(t.client, "new@example.com");
    expect(res.status).toBe(201);
    expect(res.body.mfaRequired).toBeUndefined();
    await t.client.post("/auth/logout");
    expect((await login(t.newClient(), "new@example.com")).body.data.email).toBe("new@example.com");
  });

  it("a password reset does not bypass it", async () => {
    t = await mfaForge();
    await enroll();
    const client = t.newClient();
    await client.post("/auth/forgot-password", { email: "ada@example.com" });
    const { body } = await client.post("/auth/verify-otp", { email: "ada@example.com", otp: t.email.lastCode("ada@example.com"), purpose: "password_reset" });
    await client.post("/auth/reset-password", { email: "ada@example.com", resetToken: body.resetToken, password: "Brand-new-pass-9" });
    const res = await login(t.newClient(), "ada@example.com", "Brand-new-pass-9");
    expect(res.body.mfaRequired).toBe(true);
    expect(res.body.data).toBeUndefined();
  });
});

describe("brute-force protection", () => {
  it("locks the second factor after too many wrong codes, even for the right code, then recovers", async () => {
    t = await mfaForge({ maxAttempts: 3, lockoutDuration: "5m" });
    const { secret } = await enroll();
    const client = t.newClient();
    const { mfaToken } = await firstStep(client);
    const wrong = wrongCodeFor(secret);

    expect((await client.post("/auth/mfa/verify", { mfaToken, code: wrong })).body.details.attemptsLeft).toBe(2);
    expect((await client.post("/auth/mfa/verify", { mfaToken, code: wrong })).body.details.attemptsLeft).toBe(1);
    const locking = await client.post("/auth/mfa/verify", { mfaToken, code: wrong });
    expect(locking.status).toBe(429);
    expect(locking.body.code).toBe("MFA_LOCKED");
    expect(Number(locking.headers.get("retry-after"))).toBeGreaterThan(0);

    const rightButLocked = await client.post("/auth/mfa/verify", { mfaToken, code: nextCode(secret) });
    expect(rightButLocked.status).toBe(429);
    expect(rightButLocked.body.code).toBe("MFA_LOCKED");
    expect(client.cookies).toEqual({});

    // A fresh password login does not reset the lock either.
    const other = t.newClient();
    const again = await other.post("/auth/mfa/verify", { mfaToken: (await firstStep(other)).mfaToken, code: nextCode(secret) });
    expect(again.status).toBe(429);

    await t.data.repository(MFA_FACTOR_MODEL).updateById(factor()._id, { lockedUntil: new Date(Date.now() - 1000) });
    expect((await client.post("/auth/mfa/verify", { mfaToken, code: nextCode(secret) })).status).toBe(200);
  });

  it("a successful code resets the failure counter", async () => {
    t = await mfaForge({ maxAttempts: 3 });
    const { secret } = await enroll();
    const client = t.newClient();
    const { mfaToken } = await firstStep(client);
    await client.post("/auth/mfa/verify", { mfaToken, code: wrongCodeFor(secret) });
    await client.post("/auth/mfa/verify", { mfaToken, code: wrongCodeFor(secret) });
    expect((await client.post("/auth/mfa/verify", { mfaToken, code: nextCode(secret) })).status).toBe(200);
    expect(factor().failedAttempts).toBe(0);
    expect(factor().lockedUntil ?? null).toBeNull();
  });

  it("recovery-code guesses count towards the same lock", async () => {
    t = await mfaForge({ maxAttempts: 2 });
    await enroll();
    const client = t.newClient();
    const { mfaToken } = await firstStep(client);
    await client.post("/auth/mfa/verify", { mfaToken, recoveryCode: "AAAA-AAAA-AAAA" });
    expect((await client.post("/auth/mfa/verify", { mfaToken, recoveryCode: "BBBB-BBBB-BBBB" })).status).toBe(429);
  });

  it("is limited per client by the strict limiter too", async () => {
    t = await mfaForge({}, {}, { authMaxReqLimit: 3 });
    for (let i = 0; i < 3; i++) await t.client.post("/auth/mfa/verify", { mfaToken: "x".repeat(30), code: "123456" });
    expect((await t.client.post("/auth/mfa/verify", { mfaToken: "x".repeat(30), code: "123456" })).status).toBe(429);
  });
});

describe("recovery codes", () => {
  it("sign in once each, whatever the capitalisation, spaces or dashes", async () => {
    t = await mfaForge();
    const { recoveryCodes } = await enroll();
    const client = t.newClient();

    const typed = recoveryCodes[0]!.toLowerCase().replace(/-/g, " ");
    const res = await client.post("/auth/mfa/verify", { mfaToken: (await firstStep(client)).mfaToken, recoveryCode: typed });
    expect(res.status).toBe(200);
    expect((await client.get("/auth/mfa")).body.data.recoveryCodesRemaining).toBe(9);

    const again = t.newClient();
    const reuse = await again.post("/auth/mfa/verify", { mfaToken: (await firstStep(again)).mfaToken, recoveryCode: recoveryCodes[0] });
    expect(reuse.status).toBe(401);
    expect(reuse.body.code).toBe("MFA_CODE_INVALID");
    expect(again.cookies).toEqual({});
  });

  it("rejects codes that were never issued", async () => {
    t = await mfaForge();
    await enroll();
    const client = t.newClient();
    const res = await client.post("/auth/mfa/verify", { mfaToken: (await firstStep(client)).mfaToken, recoveryCode: "ZZZZ-ZZZZ-ZZZZ" });
    expect(res.status).toBe(401);
  });

  it("can be regenerated with a valid code: the old set stops working", async () => {
    t = await mfaForge();
    const { secret, recoveryCodes } = await enroll();
    const client = t.newClient();
    await client.post("/auth/mfa/verify", { mfaToken: (await firstStep(client)).mfaToken, code: nextCode(secret) });

    expect((await client.post("/auth/mfa/recovery-codes", {})).status).toBe(422);
    expect((await client.post("/auth/mfa/recovery-codes", { code: wrongCodeFor(secret) })).status).toBe(401);
    const res = await client.post("/auth/mfa/recovery-codes", { code: nextCode(secret, 1) });
    expect(res.status).toBe(200);
    expect(res.body.data.recoveryCodes).toHaveLength(10);
    expect(res.body.data.recoveryCodes).not.toContain(recoveryCodes[0]);

    const other = t.newClient();
    const old = await other.post("/auth/mfa/verify", { mfaToken: (await firstStep(other)).mfaToken, recoveryCode: recoveryCodes[1] });
    expect(old.status).toBe(401);
    expect((await other.post("/auth/mfa/verify", { mfaToken: (await firstStep(other)).mfaToken, recoveryCode: res.body.data.recoveryCodes[0] })).status).toBe(200);
  });

  it("honours a custom number of recovery codes", async () => {
    t = await mfaForge({ recoveryCodes: 3 });
    expect((await enroll()).recoveryCodes).toHaveLength(3);
  });
});

describe("turning it off", () => {
  const signedIn = async () => {
    const e = await enroll();
    const client = t!.newClient();
    await client.post("/auth/mfa/verify", { mfaToken: (await firstStep(client)).mfaToken, code: nextCode(e.secret) });
    return { ...e, client };
  };

  it("needs a valid code (a stolen session alone is not enough)", async () => {
    t = await mfaForge();
    const { client, secret } = await signedIn();
    expect((await client.post("/auth/mfa/disable", {})).status).toBe(422);
    expect((await client.post("/auth/mfa/disable", { code: wrongCodeFor(secret) })).status).toBe(401);
    expect((await client.get("/auth/mfa")).body.data.enabled).toBe(true);
  });

  it("works with a code, after which sign-in is single-step again", async () => {
    t = await mfaForge();
    const { client, secret } = await signedIn();
    const res = await client.post("/auth/mfa/disable", { code: nextCode(secret, 1) });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ enabled: false });
    expect(t.data.repository(MFA_FACTOR_MODEL).dump()).toHaveLength(0);
    const next = await login(t.newClient());
    expect(next.body.mfaRequired).toBeUndefined();
    expect(next.body.data.email).toBe("ada@example.com");
  });

  it("works with a recovery code (lost phone)", async () => {
    t = await mfaForge();
    const { client, recoveryCodes } = await signedIn();
    expect((await client.post("/auth/mfa/disable", { recoveryCode: recoveryCodes[2] })).status).toBe(200);
  });

  it("answers 409 MFA_NOT_ENABLED when there is nothing to disable", async () => {
    t = await mfaForge();
    await signup(t.client);
    const res = await t.client.post("/auth/mfa/disable", { code: "123456" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("MFA_NOT_ENABLED");
  });

  it("deleting the account removes the second factor and any linked sign-in records", async () => {
    t = await mfaForge({}, { magicLink: undefined });
    const { client } = await signedIn();
    expect((await client.delete("/account/me")).status).toBe(200);
    expect(t.data.repository(MFA_FACTOR_MODEL).dump()).toHaveLength(0);
    expect(t.data.has(OAUTH_IDENTITY_MODEL)).toBe(false);
    expect(t.data.has(MAGIC_LINK_MODEL)).toBe(false);
  });
});

describe("isolation between users", () => {
  it("each user has their own secret, codes and lock", async () => {
    t = await mfaForge({ maxAttempts: 2 });
    const ada = await enroll("ada@example.com");
    const bob = await enroll("bob@example.com");
    expect(ada.secret).not.toBe(bob.secret);

    const c = t.newClient();
    const { mfaToken } = await firstStep(c, "ada@example.com");
    await c.post("/auth/mfa/verify", { mfaToken, code: wrongCodeFor(ada.secret) });
    await c.post("/auth/mfa/verify", { mfaToken, code: wrongCodeFor(ada.secret) });

    const d = t.newClient();
    expect((await d.post("/auth/mfa/verify", { mfaToken: (await firstStep(d, "bob@example.com")).mfaToken, code: nextCode(bob.secret) })).status).toBe(200);
  });
});

describe("configuration", () => {
  const problems = (fn: () => unknown): string => {
    try { fn(); } catch (e) { return ((e as any).details.problems as string[]).join("\n"); }
    throw new Error("expected a ConfigurationError");
  };
  const cfg = (mfa: unknown, extra: Record<string, unknown> = {}) =>
    () => new ForgeConfig({ ENV: "test", jwtSecret: TEST_JWT_SECRET, masterKey: "A".repeat(43) + "=", builtinConfig: { auth: testAuthConfig({ mfa }) as never }, ...extra });

  it("accepts a minimal setup and applies defaults", () => {
    const config = cfg({ issuer: "Acme" })();
    expect(config.auth.mfa).toMatchObject({ issuer: "Acme", maxAttempts: 5, recoveryCodes: 10, window: 1 });
    expect(config.auth.mfa!.challengeAge.toMs()).toBe(300_000);
    expect(config.auth.mfa!.lockoutDuration.toMs()).toBe(300_000);
    expect(new ForgeConfig({ ENV: "test" }).auth.mfa).toBeUndefined();
  });

  it("requires a master key, because secrets are encrypted at rest", () => {
    expect(problems(cfg({ issuer: "Acme" }, { masterKey: undefined }))).toMatch(/masterKey is required for auth\.mfa/);
  });

  it("requires an issuer and sane limits", () => {
    expect(problems(cfg({ issuer: "  " }))).toMatch(/issuer is required/);
    expect(problems(cfg({ issuer: "A", maxAttempts: 0 }))).toMatch(/maxAttempts/);
    expect(problems(cfg({ issuer: "A", recoveryCodes: 99 }))).toMatch(/recoveryCodes/);
    expect(problems(cfg({ issuer: "A", window: 9 }))).toMatch(/window/);
    expect(problems(cfg({ issuer: "A", challengeAge: "soon" }))).toMatch(/challengeAge/);
  });

  it("needs a jwtSecret (it signs the challenge)", () => {
    expect(problems(() => new ForgeConfig({ ENV: "test", masterKey: "A".repeat(43) + "=", builtinConfig: { auth: { mode: "manual", mfa: { issuer: "A" } } } }))).toMatch(/jwtSecret is required/);
  });
});

describe("GET /auth/methods", () => {
  it("tells the front-end what to offer", async () => {
    t = await mfaForge({}, { signupMode: "otp", loginMode: "credentials", oauth: { providers: [{ provider: "github", clientId: "i", clientSecret: "s" }] } });
    const res = await t.client.get("/auth/methods");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      password: { signup: "otp", login: "credentials" },
      magicLink: null,
      oauth: [{ name: "github", displayName: "GitHub", url: "/api/v1/auth/oauth/github" }],
      mfa: { totp: true },
    });
  });

  it("reports nothing for features that are off, and is public", async () => {
    t = await authForge();
    const res = await t.newClient().get("/auth/methods");
    expect(res.body.data).toMatchObject({ magicLink: null, oauth: [], mfa: null });
  });
});
