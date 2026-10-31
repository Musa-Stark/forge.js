import { afterEach, describe, expect, it } from "vitest";
import type { TestForge } from "../src/testing/index.js";
import { authForge, login, otpRows, PASSWORD, signup } from "./helpers.js";

let t: TestForge;
afterEach(() => t?.close());

const otpAuth = (extra: Record<string, unknown> = {}) => authForge({ signupMode: "otp", loginMode: "otp", ...extra });
const verify = (client = t.client, email = "ada@example.com", otp = "", purpose = "signup") =>
  client.post("/auth/verify-otp", { email, otp, purpose });

describe("OTP signup", () => {
  it("sends a code, creates nothing yet, and finishes after verification", async () => {
    t = await otpAuth();
    const res = await signup(t.client);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeUndefined();
    expect(t.data.repository("User").dump()).toHaveLength(0);
    expect(t.email.sent).toHaveLength(1);
    expect(t.email.sent[0]).toMatchObject({ to: "ada@example.com", subject: "Confirm your e-mail address" });

    const code = t.email.lastCode("ada@example.com");
    const done = await verify(t.client, "ada@example.com", code);
    expect(done.status).toBe(201);
    expect(done.body.data).toMatchObject({ email: "ada@example.com", role: "user" });
    expect(t.client.cookies).toHaveProperty("accessToken");
    expect(t.data.repository("User").dump()[0]!.password).toMatch(/^\$argon2id\$/);
  });

  it("stores only a keyed hash of the code, and the hashed password in the pending payload", async () => {
    t = await otpAuth();
    await signup(t.client);
    const code = t.email.lastCode("ada@example.com");
    const [row] = otpRows(t);
    expect(JSON.stringify(row)).not.toContain(code);
    expect(row!.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(PASSWORD);
    expect(row!.payload.password).toMatch(/^\$argon2id\$/);
  });

  it("consumes the code: it cannot be used twice", async () => {
    t = await otpAuth();
    await signup(t.client);
    const code = t.email.lastCode("ada@example.com");
    expect((await verify(t.client, "ada@example.com", code)).status).toBe(201);
    const again = await verify(t.newClient(), "ada@example.com", code);
    expect(again.status).toBe(404);
    expect(again.body.code).toBe("OTP_NOT_FOUND");
  });

  it("strips a role chosen by the caller from the pending payload", async () => {
    t = await otpAuth();
    await signup(t.client, "ada@example.com", { role: "admin" });
    await verify(t.client, "ada@example.com", t.email.lastCode("ada@example.com"));
    expect(t.data.repository("User").dump()[0]!.role).toBe("user");
  });

  it("rejects a wrong code and reports the attempts left", async () => {
    t = await otpAuth();
    await signup(t.client);
    const real = t.email.lastCode("ada@example.com");
    const wrong = real === "000000" ? "111111" : "000000";
    const res = await verify(t.client, "ada@example.com", wrong);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("OTP_INVALID");
    expect(res.body.details.attemptsLeft).toBe(4);
  });

  it("locks the code after the allowed number of wrong guesses (brute-force protection)", async () => {
    t = await otpAuth({ otp: { maxAttempts: 3 } });
    await signup(t.client);
    const real = t.email.lastCode("ada@example.com");
    const wrong = real === "000000" ? "111111" : "000000";
    for (let i = 0; i < 3; i++) expect((await verify(t.client, "ada@example.com", wrong)).body.code).toBe("OTP_INVALID");

    // Even the right code no longer works, because the request was burned.
    const locked = await verify(t.client, "ada@example.com", real);
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe("OTP_ATTEMPTS_EXCEEDED");
    expect((await verify(t.client, "ada@example.com", real)).body.code).toBe("OTP_NOT_FOUND");
  });

  it("rejects an expired code", async () => {
    t = await otpAuth();
    await signup(t.client);
    const [row] = otpRows(t);
    await t.data.repository("ForgeOtpRequest").updateById(row!._id, { expiresAt: new Date(Date.now() - 1000) });
    const res = await verify(t.client, "ada@example.com", t.email.lastCode("ada@example.com"));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("OTP_EXPIRED");
  });

  it("lets a user start over after a code expired (1.x blocked them forever)", async () => {
    t = await otpAuth({ otp: { resendCooldown: "0s" } });
    await signup(t.client);
    const [row] = otpRows(t);
    await t.data.repository("ForgeOtpRequest").updateById(row!._id, { expiresAt: new Date(Date.now() - 1000) });
    expect((await signup(t.client)).status).toBe(200);
    const code = t.email.lastCode("ada@example.com");
    expect((await verify(t.client, "ada@example.com", code)).status).toBe(201);
  });

  it("rejects badly shaped codes and purposes at validation", async () => {
    t = await otpAuth();
    expect((await verify(t.client, "ada@example.com", "12345")).status).toBe(422);
    expect((await verify(t.client, "ada@example.com", "abcdef")).status).toBe(422);
    expect((await verify(t.client, "ada@example.com", "123456", "admin_takeover")).status).toBe(422);
  });

  it("does not let a code for one purpose finish another", async () => {
    t = await otpAuth();
    await signup(t.client);
    const res = await verify(t.client, "ada@example.com", t.email.lastCode("ada@example.com"), "password_reset");
    expect(res.status).toBe(404);
  });

  it("requires no login to verify a code (1.x demanded an access token it could not have)", async () => {
    t = await otpAuth();
    await signup(t.client);
    const stranger = t.newClient();
    const res = await verify(stranger, "ada@example.com", t.email.lastCode("ada@example.com"));
    expect(res.status).toBe(201);
  });

  it("does not create an account twice if it was registered while a code was pending", async () => {
    t = await otpAuth();
    await signup(t.client);
    const code = t.email.lastCode("ada@example.com");
    await t.data.repository("User").create({ name: "Other", email: "ada@example.com", password: "x".repeat(10) });
    const res = await verify(t.client, "ada@example.com", code);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DUPLICATE_KEY");
  });
});

describe("resend and cooldown", () => {
  it("refuses a second request inside the cooldown, with Retry-After", async () => {
    t = await otpAuth();
    await signup(t.client);
    const res = await signup(t.client);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("OTP_RESEND_COOLDOWN");
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(t.email.sent).toHaveLength(1);
  });

  it("resends a new code after the cooldown, and the old code stops working", async () => {
    t = await otpAuth({ otp: { resendCooldown: "0s" } });
    await signup(t.client);
    const first = t.email.lastCode("ada@example.com");

    const res = await t.client.post("/auth/resend-otp", { email: "ada@example.com", purpose: "signup" });
    expect(res.status).toBe(200);
    expect(t.email.sent).toHaveLength(2);

    const second = t.email.lastCode("ada@example.com");
    if (first !== second) expect((await verify(t.client, "ada@example.com", first)).body.code).toBe("OTP_INVALID");
    expect((await verify(t.client, "ada@example.com", second)).status).toBe(201);
  });

  it("caps the number of resends", async () => {
    t = await otpAuth({ otp: { resendCooldown: "0s", maxResends: 2 } });
    await signup(t.client);
    expect((await t.client.post("/auth/resend-otp", { email: "ada@example.com", purpose: "signup" })).status).toBe(200);
    expect((await t.client.post("/auth/resend-otp", { email: "ada@example.com", purpose: "signup" })).status).toBe(200);
    const res = await t.client.post("/auth/resend-otp", { email: "ada@example.com", purpose: "signup" });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("OTP_RESEND_LIMIT");
  });

  it("returns 404 OTP_NOT_FOUND when there is nothing to resend", async () => {
    t = await otpAuth();
    const res = await t.client.post("/auth/resend-otp", { email: "nobody@example.com", purpose: "signup" });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("OTP_NOT_FOUND");
  });

  it("resets the attempt counter when a new code is issued", async () => {
    t = await otpAuth({ otp: { resendCooldown: "0s", maxAttempts: 2 } });
    await signup(t.client);
    const real = t.email.lastCode("ada@example.com");
    const wrong = real === "000000" ? "111111" : "000000";
    await verify(t.client, "ada@example.com", wrong);
    await t.client.post("/auth/resend-otp", { email: "ada@example.com", purpose: "signup" });
    expect(otpRows(t)[0]!.attempts).toBe(0);
  });
});

describe("OTP login", () => {
  it("checks the password first, then e-mails a code that opens the session", async () => {
    t = await otpAuth({ signupMode: "credentials" });
    await signup(t.client);
    t.email.sent.length = 0;

    const res = await login(t.newClient());
    expect(res.status).toBe(200);
    expect(res.body.data).toBeUndefined();
    expect(t.email.sent[0]!.subject).toBe("Your login code");

    const client = t.newClient();
    const done = await client.post("/auth/verify-otp", { email: "ada@example.com", otp: t.email.lastCode("ada@example.com"), purpose: "login" });
    expect(done.status).toBe(200);
    expect(client.cookies).toHaveProperty("accessToken");
  });

  it("sends no code when the password is wrong", async () => {
    t = await otpAuth({ signupMode: "credentials" });
    await signup(t.client);
    t.email.sent.length = 0;
    const res = await login(t.newClient(), "ada@example.com", "Wrong-password-1");
    expect(res.status).toBe(401);
    expect(t.email.sent).toHaveLength(0);
  });
});

describe("email delivery problems", () => {
  it("surfaces a mail-provider failure without leaking its message", async () => {
    t = await otpAuth();
    t.email.failNext = true;
    const res = await signup(t.client);
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("simulated provider failure");
  });
});

describe("password reset", () => {
  const forgot = (client = t.client, email = "ada@example.com") => client.post("/auth/forgot-password", { email });

  const verifyReset = async (email = "ada@example.com") => {
    const res = await t.client.post("/auth/verify-otp", { email, otp: t.email.lastCode(email), purpose: "password_reset" });
    return res;
  };

  it("answers the same for registered and unknown e-mails (no enumeration) and only mails real users", async () => {
    t = await authForge();
    await signup(t.client);
    t.email.sent.length = 0;

    const known = await forgot(t.newClient(), "ada@example.com");
    const unknown = await forgot(t.newClient(), "ghost@example.com");
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(t.email.sent.map((e) => e.to)).toEqual(["ada@example.com"]);
  });

  it("completes the full flow and invalidates the old password and all sessions", async () => {
    t = await authForge();
    const { body: s } = await signup(t.client);
    await forgot();

    const verified = await verifyReset();
    expect(verified.status).toBe(200);
    expect(verified.body.resetToken).toBeTypeOf("string");

    const reset = await t.client.post("/auth/reset-password", { email: "ada@example.com", resetToken: verified.body.resetToken, password: "Brand-new-pass-9" });
    expect(reset.status).toBe(200);

    expect((await login(t.newClient())).status).toBe(401);
    expect((await login(t.newClient(), "ada@example.com", "Brand-new-pass-9")).status).toBe(200);

    const oldSession = await t.newClient().post("/auth/refresh-token", { refreshToken: s.refreshToken });
    expect(oldSession.status).toBe(401);
  });

  it("cannot be used without proving the code first (1.x let a verified flag be reused)", async () => {
    t = await authForge();
    await signup(t.client);
    await forgot();
    const res = await t.client.post("/auth/reset-password", { email: "ada@example.com", resetToken: "x".repeat(43), password: "Brand-new-pass-9" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("RESET_TOKEN_INVALID");
  });

  it("makes the reset token single-use", async () => {
    t = await authForge();
    await signup(t.client);
    await forgot();
    const { body } = await verifyReset();
    const payload = { email: "ada@example.com", resetToken: body.resetToken, password: "Brand-new-pass-9" };
    expect((await t.client.post("/auth/reset-password", payload)).status).toBe(200);
    expect((await t.client.post("/auth/reset-password", { ...payload, password: "Another-pass-77" })).status).toBe(400);
  });

  it("expires the reset token", async () => {
    t = await authForge();
    await signup(t.client);
    await forgot();
    const { body } = await verifyReset();
    const [row] = otpRows(t);
    await t.data.repository("ForgeOtpRequest").updateById(row!._id, { resetExpiresAt: new Date(Date.now() - 1000) });
    const res = await t.client.post("/auth/reset-password", { email: "ada@example.com", resetToken: body.resetToken, password: "Brand-new-pass-9" });
    expect(res.body.code).toBe("RESET_TOKEN_INVALID");
  });

  it("does not accept the reset token for a different e-mail", async () => {
    t = await authForge();
    await signup(t.client);
    await signup(t.newClient(), "bob@example.com");
    await forgot();
    const { body } = await verifyReset();
    const res = await t.client.post("/auth/reset-password", { email: "bob@example.com", resetToken: body.resetToken, password: "Brand-new-pass-9" });
    expect(res.status).toBe(400);
  });

  it("enforces password rules on the new password", async () => {
    t = await authForge();
    await signup(t.client);
    await forgot();
    const { body } = await verifyReset();
    const res = await t.client.post("/auth/reset-password", { email: "ada@example.com", resetToken: body.resetToken, password: "short" });
    expect(res.status).toBe(422);
  });

  it("does not leak the code state: a wrong reset code is just invalid", async () => {
    t = await authForge();
    await signup(t.client);
    await forgot();
    const real = t.email.lastCode("ada@example.com");
    const wrong = real === "000000" ? "111111" : "000000";
    const res = await t.client.post("/auth/verify-otp", { email: "ada@example.com", otp: wrong, purpose: "password_reset" });
    expect(res.body.code).toBe("OTP_INVALID");
  });

  it("keeps working when the user asks twice quickly (cooldown is swallowed, not an error)", async () => {
    t = await authForge();
    await signup(t.client);
    expect((await forgot()).status).toBe(200);
    expect((await forgot()).status).toBe(200);
    expect(t.email.sent.filter((e) => e.subject === "Reset your password")).toHaveLength(1);
  });
});
