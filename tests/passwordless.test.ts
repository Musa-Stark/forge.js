import { describe, expect, it } from "vitest";
import { AccountLinkPolicy } from "../src/auth/AccountLinkPolicy.js";
import { LoginCompleter } from "../src/auth/LoginCompleter.js";
import { UserProvisioner } from "../src/auth/UserProvisioner.js";
import { ForgeConfig } from "../src/config/ForgeConfig.js";
import type { AccountLinking } from "../src/config/ForgeOptions.js";
import { PasswordHasher } from "../src/security/PasswordHasher.js";
import { TokenService } from "../src/security/TokenService.js";
import { InMemoryDataSource, testAuthConfig, TEST_JWT_SECRET } from "../src/testing/index.js";

const config = (auth: Record<string, unknown> = {}) =>
  new ForgeConfig({ ENV: "test", jwtSecret: TEST_JWT_SECRET, masterKey: "A".repeat(43) + "=", builtinConfig: { auth: testAuthConfig(auth) as never } });

describe("AccountLinkPolicy", () => {
  const policy = (signupMode: "otp" | "credentials") => new AccountLinkPolicy(config({ signupMode }));

  it.each<[AccountLinking, "otp" | "credentials", boolean]>([
    ["auto", "otp", true],
    ["auto", "credentials", false],
    ["always", "otp", true],
    ["always", "credentials", true],
    ["never", "otp", false],
    ["never", "credentials", false],
  ])("policy %s with %s sign-up allows linking: %s", (linking, signupMode, allowed) => {
    expect(policy(signupMode).isAllowed(linking)).toBe(allowed);
    if (allowed) expect(() => policy(signupMode).assertMayLink(linking, "x")).not.toThrow();
    else expect(() => policy(signupMode).assertMayLink(linking, "x")).toThrowError(expect.objectContaining({ statusCode: 409, code: "ACCOUNT_LINK_BLOCKED" }));
  });

  it("explains how to fix a blocked link, and names the method", () => {
    expect(() => policy("credentials").assertMayLink("auto", "magic links")).toThrowError(expect.objectContaining({ hint: expect.stringContaining("signupMode: 'otp'") }));
    expect(() => policy("otp").assertMayLink("never", "magic links")).toThrowError(expect.objectContaining({ hint: "accountLinking is 'never' for magic links." }));
  });
});

describe("UserProvisioner", () => {
  const make = (known: string[] = ["name", "email", "password", "role"]) => {
    const created: Array<Record<string, unknown>> = [];
    const plaintexts: string[] = [];
    const hasher = { hash: async (p: string) => (plaintexts.push(p), `hashed(${p.length})`) } as unknown as PasswordHasher;
    const users = { create: async (d: Record<string, unknown>) => (created.push(d), { _id: "a".repeat(24), ...d }) } as never;
    return { created, plaintexts, provisioner: new UserProvisioner(config(), () => users, hasher, new Set(known)) };
  };

  it("creates the user with the e-mail, a name, and a hashed password", async () => {
    const { created, provisioner } = make();
    await provisioner.create({ email: "kim@example.com", name: " Kim Lee " });
    expect(created[0]).toEqual({ name: "Kim Lee", email: "kim@example.com", password: "hashed(43)" });
  });

  it("gives every user a long, random, unrelated password (it is never disclosed and never guessable)", async () => {
    const { plaintexts, provisioner } = make();
    await provisioner.create({ email: "a@example.com" });
    await provisioner.create({ email: "a@example.com" });
    expect(plaintexts).toHaveLength(2);
    expect(plaintexts[0]).not.toBe(plaintexts[1]);
    for (const p of plaintexts) {
      expect(p.length).toBeGreaterThanOrEqual(40);
      expect(p).not.toContain("example");
      expect(p).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("falls back to the e-mail's local part, and skips 'name' when the schema has none", async () => {
    const withName = make();
    await withName.provisioner.create({ email: "kim@example.com" });
    expect(withName.created[0]!.name).toBe("kim");
    const without = make(["email", "password"]);
    await without.provisioner.create({ email: "kim@example.com", name: "Kim" });
    expect(without.created[0]).not.toHaveProperty("name");
  });

  it("lets extra fields in, but never lets them change the e-mail or the password", async () => {
    const { created, provisioner } = make();
    await provisioner.create({ email: "real@example.com", extra: { username: "kim", email: "evil@example.com", password: "plain" } });
    expect(created[0]).toMatchObject({ username: "kim", email: "real@example.com", password: "hashed(43)" });
  });
});

describe("LoginCompleter", () => {
  const tokens = new TokenService(TEST_JWT_SECRET);
  const sessions = { start: async (id: string) => ({ accessToken: `a-${id}`, refreshToken: `r-${id}` }) } as never;
  const user = { _id: "b".repeat(24), email: "ada@example.com" };
  const make = (auth: Record<string, unknown>, enabled: boolean) => {
    const calls: string[] = [];
    const mfa = { isEnabled: async (id: string) => (calls.push(id), enabled) } as never;
    return { calls, completer: new LoginCompleter(config(auth), sessions, tokens, () => mfa) };
  };

  it("starts a session when two-factor is not configured (and never asks)", async () => {
    const { calls, completer } = make({}, true);
    const result = await completer.complete(user, {} as never);
    expect(result).toMatchObject({ kind: "session", created: false, tokens: { accessToken: `a-${user._id}` } });
    expect(calls).toEqual([]);
  });

  it("starts a session when it is configured but this user has not enabled it", async () => {
    const { completer } = make({ mfa: { issuer: "A" } }, false);
    expect((await completer.complete(user, {} as never)).kind).toBe("session");
  });

  it("demands the second factor when the user enabled it: a challenge, never a session", async () => {
    const { calls, completer } = make({ mfa: { issuer: "A" } }, true);
    const result = await completer.complete(user, {} as never);
    expect(result.kind).toBe("mfa-required");
    expect(result).not.toHaveProperty("tokens");
    expect(calls).toEqual([user._id]);
    expect(tokens.verifyMfaChallenge((result as { mfaToken: string }).mfaToken).sub).toBe(user._id);
  });

  it("does not ask for a second factor from an account that was created a moment ago", async () => {
    const { calls, completer } = make({ mfa: { issuer: "A" } }, true);
    expect(await completer.complete(user, {} as never, { created: true })).toMatchObject({ kind: "session", created: true });
    expect(calls).toEqual([]);
  });

  it("startSession skips the check by design (it is for after the factors were verified)", async () => {
    const { calls, completer } = make({ mfa: { issuer: "A" } }, true);
    expect((await completer.startSession(user, {} as never)).kind).toBe("session");
    expect(calls).toEqual([]);
  });
});

describe("MFA challenge tokens", () => {
  const tokens = new TokenService(TEST_JWT_SECRET);
  const data = new InMemoryDataSource();
  it("round-trip and refuse other token types", () => {
    expect(data).toBeDefined();
    const ch = tokens.signMfaChallenge("u1", { toSeconds: () => 60 } as never);
    expect(tokens.verifyMfaChallenge(ch)).toMatchObject({ sub: "u1", typ: "mfa" });
    expect(() => tokens.verifyAccess(ch)).toThrow();
    expect(() => tokens.verifyRefresh(ch)).toThrow();
    expect(() => tokens.verifyOAuthState(ch)).toThrow();
    expect(() => tokens.verifyMfaChallenge(tokens.signAccess("u1", { toSeconds: () => 60 } as never))).toThrow();
    for (const bad of [undefined, "", "x.y.z", 5 as never]) expect(() => tokens.verifyMfaChallenge(bad)).toThrow();
  });
});
