import { z } from "zod";
import { afterEach, describe, expect, it } from "vitest";
import {
  collection, fields, Forge, GitHubProvider, GoogleProvider, OAuthProvider, OAuthProviderRegistry,
  type OAuthProfile, type TokenSet,
} from "../src/index.js";
import { ForgeConfig } from "../src/config/ForgeConfig.js";
import { Duration } from "../src/config/Duration.js";
import { OAuthProviderFactory } from "../src/oauth/OAuthProviderFactory.js";
import { pkce } from "../src/oauth/pkce.js";
import { safeReturnPath } from "../src/oauth/returnPath.js";
import { PasswordHasher } from "../src/security/PasswordHasher.js";
import { TokenService } from "../src/security/TokenService.js";
import { createTestForge, FakeOAuthServer, InMemoryDataSource, testAuthConfig, TEST_JWT_SECRET, type FakeIdentity, type TestForge } from "../src/testing/index.js";
import { OAUTH_IDENTITY_MODEL } from "../src/data/internalModels.js";
import { authForge, login, PASSWORD, refreshTokenRows } from "./helpers.js";

let t: TestForge | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
});

const CREDS = { clientId: "test-client-id", clientSecret: "test-client-secret" };
const google = { provider: "google" as const, ...CREDS };
const github = { provider: "github" as const, ...CREDS };

const ADA: FakeIdentity = { id: "1001", email: "ada@example.com", emailVerified: true, name: "Ada Lovelace", picture: "https://img.example/ada.png" };

const oauthForge = (oauth: Record<string, unknown> = {}, auth: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  authForge({ oauth: { providers: [google, github], ...oauth }, ...auth }, extra);

/** Starts the flow, approves at the (fake) provider, and completes the callback. */
const signIn = async (provider: "google" | "github", identity: FakeIdentity, client = t!.newClient()) => {
  const start = await client.get(`/auth/oauth/${provider}`);
  const location = start.headers.get("location")!;
  const res = await client.get(t!.oauth.approve(location, identity));
  return { client, start, location, res };
};

const identities = () => t!.data.repository(OAUTH_IDENTITY_MODEL).dump();
const users = () => t!.data.repository("User").dump();

const seedUser = async (email = "ada@example.com", extra: Record<string, unknown> = {}) =>
  t!.data.repository("User").create({ name: "Local Ada", email, password: await new PasswordHasher().hash(PASSWORD), ...extra });

/* ───────────────────────── unit: protocol building blocks ───────────────────────── */

describe("PKCE", () => {
  it("matches the RFC 7636 test vector", () => {
    expect(pkce.challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
  it("generates long, unique, URL-safe verifiers", () => {
    const a = pkce.generateVerifier();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pkce.generateVerifier()).not.toBe(a);
  });
});

describe("safeReturnPath", () => {
  it.each([["/dashboard", "/dashboard"], ["/a/b?x=1#frag", "/a/b?x=1#frag"], ["/", "/"]])("accepts %s", (input, out) => {
    expect(safeReturnPath(input)).toBe(out);
  });
  it.each([
    "https://evil.com", "//evil.com", "/\\evil.com", "\\\\evil.com", "javascript:alert(1)", "dashboard", "", "/a\r\nSet-Cookie: x=1",
    "/a\u0000b", "/" + "a".repeat(600), undefined, null, 5, ["/x"], { a: 1 },
  ])("rejects %j", (input) => expect(safeReturnPath(input)).toBeUndefined());
});

describe("OAuth state envelope", () => {
  const tokens = new TokenService("s".repeat(40));
  const age = Duration.parse("10m");

  it("round-trips", () => {
    const token = tokens.signOAuthState({ prv: "google", st: "abc", cv: "ver", rt: "/x" }, age);
    expect(tokens.verifyOAuthState(token)).toMatchObject({ prv: "google", st: "abc", cv: "ver", rt: "/x", typ: "oauth_state" });
  });
  it.each([undefined, "", "garbage", "a.b.c"])("rejects %j with OAUTH_STATE_INVALID", (bad) => {
    expect(() => tokens.verifyOAuthState(bad)).toThrowError(expect.objectContaining({ code: "OAUTH_STATE_INVALID", statusCode: 400 }));
  });
  it("is not interchangeable with session tokens (either direction)", () => {
    expect(() => tokens.verifyOAuthState(tokens.signAccess("u", age))).toThrow();
    expect(() => tokens.verifyAccess(tokens.signOAuthState({ prv: "google", st: "s" }, age))).toThrow();
    expect(() => tokens.verifyRefresh(tokens.signOAuthState({ prv: "google", st: "s" }, age))).toThrow();
  });
  it("detects tampering and a different secret", () => {
    const token = tokens.signOAuthState({ prv: "google", st: "abc" }, age);
    expect(() => tokens.verifyOAuthState(token.slice(0, -3) + "AAA")).toThrow();
    expect(() => new TokenService("x".repeat(40)).verifyOAuthState(token)).toThrow();
  });
});

describe("OAuthProviderRegistry", () => {
  const p = (name: string) => new (class extends GoogleProvider { override readonly name = name; })(CREDS);

  it("registers, lists and finds providers", () => {
    const registry = new OAuthProviderRegistry().register(new GoogleProvider(CREDS)).register(new GitHubProvider(CREDS));
    expect(registry.size).toBe(2);
    expect(registry.has("github")).toBe(true);
    expect(registry.list().map((x) => x.name)).toEqual(["google", "github"]);
    expect(registry.get("google")).toBeInstanceOf(GoogleProvider);
  });
  it("answers 404 OAUTH_PROVIDER_NOT_FOUND for unknown providers and truncates hostile names", () => {
    const registry = new OAuthProviderRegistry();
    expect(() => registry.get("nope")).toThrowError(expect.objectContaining({ statusCode: 404, code: "OAUTH_PROVIDER_NOT_FOUND" }));
    expect(() => registry.get("x".repeat(500))).toThrowError(expect.objectContaining({ message: expect.not.stringContaining("x".repeat(100)) }));
  });
  it("refuses duplicates, bad names and the reserved name", () => {
    const registry = new OAuthProviderRegistry().register(p("one"));
    expect(() => registry.register(p("one"))).toThrow(/twice/);
    for (const bad of ["Google", "a", "1abc", "with space", "../x", "providers", "x".repeat(40)]) expect(() => registry.register(p(bad)), bad).toThrow(/Invalid OAuth provider name/);
  });
});

describe("OAuthProviderFactory", () => {
  const factory = new OAuthProviderFactory();
  it("builds the built-in providers from shorthand config", () => {
    expect(factory.create(google)).toBeInstanceOf(GoogleProvider);
    expect(factory.create(github)).toBeInstanceOf(GitHubProvider);
  });
  it("passes provider instances through untouched", () => {
    const own = new GoogleProvider(CREDS);
    expect(factory.create(own)).toBe(own);
    expect(OAuthProviderFactory.nameOf(own)).toBe("google");
    expect(OAuthProviderFactory.nameOf(github)).toBe("github");
  });
  it("explains how to add other providers when the name is unknown", () => {
    expect(() => factory.create({ provider: "myspace" as never, ...CREDS })).toThrowError(expect.objectContaining({ code: "CONFIGURATION_ERROR", hint: expect.stringContaining("subclass") }));
  });
  it("requires credentials", () => {
    expect(() => new GoogleProvider({ clientId: "", clientSecret: "s" })).toThrow(/clientId/);
    expect(() => new GoogleProvider({ clientId: "i", clientSecret: "" })).toThrow(/clientSecret/);
  });
  it("hands the default fetch to built-in providers", async () => {
    const server = new FakeOAuthServer();
    const provider = factory.create(google, { fetch: server.fetch });
    await expect(provider.exchangeCode("nope", "http://x/cb")).rejects.toMatchObject({ code: "OAUTH_CODE_INVALID" });
    expect(server.requests).toHaveLength(1);
  });
});

/* ───────────────────────── unit: providers ───────────────────────── */

describe("authorization URLs", () => {
  const params = { state: "STATE", redirectUri: "https://api.example.com/cb", codeChallenge: "CHALLENGE" };
  const parse = (url: string) => new URL(url);

  it("Google: OpenID scopes, state and PKCE S256", () => {
    const url = parse(new GoogleProvider(CREDS).buildAuthorizationUrl(params));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: "code", client_id: CREDS.clientId, redirect_uri: params.redirectUri, scope: "openid email profile",
      state: "STATE", code_challenge: "CHALLENGE", code_challenge_method: "S256",
    });
  });
  it("GitHub: user:email scope and PKCE", () => {
    const url = parse(new GitHubProvider(CREDS).buildAuthorizationUrl(params));
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("scope")).toBe("read:user user:email");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
  it("accepts custom scopes and extra parameters, but never lets config override security parameters", () => {
    const provider = new GoogleProvider({
      ...CREDS, scopes: ["openid", "email"],
      authorizationParams: { prompt: "select_account", state: "EVIL", redirect_uri: "https://evil.example", client_id: "x", code_challenge: "weak", response_type: "token", scope: "all" },
    });
    const url = parse(provider.buildAuthorizationUrl(params));
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.get("scope")).toBe("openid email");
    expect(url.searchParams.get("state")).toBe("STATE");
    expect(url.searchParams.get("redirect_uri")).toBe(params.redirectUri);
    expect(url.searchParams.get("client_id")).toBe(CREDS.clientId);
    expect(url.searchParams.get("code_challenge")).toBe("CHALLENGE");
    expect(url.searchParams.get("response_type")).toBe("code");
  });
  it("leaves PKCE parameters out for a provider that does not support it", () => {
    class NoPkce extends GoogleProvider { override readonly usesPkce = false; }
    const url = parse(new NoPkce(CREDS).buildAuthorizationUrl(params));
    expect(url.searchParams.has("code_challenge")).toBe(false);
    expect(url.searchParams.get("state")).toBe("STATE");
  });
});

describe("code exchange", () => {
  const make = (server = new FakeOAuthServer(), Type: typeof GoogleProvider | typeof GitHubProvider = GoogleProvider) =>
    ({ server, provider: new Type({ ...CREDS, fetch: server.fetch }) });
  const kind = (p: "google" | "github") => (p === "google" ? "google" : "github") as "google" | "github";

  it("posts the standard form including the client secret and PKCE verifier", async () => {
    const { server, provider } = make();
    const verifier = pkce.generateVerifier();
    const code = server.issueCode(kind("google"), ADA, { codeChallenge: pkce.challengeFor(verifier) });
    const tokens = await provider.exchangeCode(code, "https://api.example.com/cb", verifier);
    expect(tokens.accessToken).toMatch(/^google-access-/);
    expect(server.requests[0]!.form).toMatchObject({
      grant_type: "authorization_code", code, redirect_uri: "https://api.example.com/cb", client_id: CREDS.clientId, client_secret: CREDS.clientSecret, code_verifier: verifier,
    });
    expect(server.requests[0]!.headers["content-type"]).toBe("application/x-www-form-urlencoded");
  });

  it("rejects a wrong PKCE verifier as an invalid code", async () => {
    const { server, provider } = make();
    const code = server.issueCode("google", ADA, { codeChallenge: pkce.challengeFor("the-real-verifier") });
    await expect(provider.exchangeCode(code, "http://x/cb", "an-attacker-guess")).rejects.toMatchObject({ statusCode: 400, code: "OAUTH_CODE_INVALID" });
  });

  it("treats a used or unknown code as invalid (Google: HTTP 400)", async () => {
    const { server, provider } = make();
    const code = server.issueCode("google", ADA);
    await provider.exchangeCode(code, "http://x/cb");
    await expect(provider.exchangeCode(code, "http://x/cb")).rejects.toMatchObject({ code: "OAUTH_CODE_INVALID" });
  });

  it("recognises GitHub's HTTP 200 + error body", async () => {
    const { provider } = make(new FakeOAuthServer(), GitHubProvider);
    await expect(provider.exchangeCode("nope", "http://x/cb")).rejects.toMatchObject({ statusCode: 400, code: "OAUTH_CODE_INVALID" });
  });

  it("turns provider outages into 502 and exposes only the short error code", async () => {
    const { server, provider } = make();
    server.failNext("token", { status: 500, body: { error: "server_error", error_description: "db password is hunter2", secret: CREDS.clientSecret } });
    const error: any = await provider.exchangeCode("x", "http://x/cb").catch((e) => e);
    expect(error.statusCode).toBe(502);
    expect(error.code).toBe("OAUTH_PROVIDER_ERROR");
    expect(error.details).toEqual({ provider: "google", operation: "token exchange", status: 500, providerError: "server_error" });
    expect(JSON.stringify(error.details) + error.message).not.toMatch(/hunter2|test-client-secret/);
  });

  it("turns network failures and malformed answers into 502", async () => {
    const a = make();
    a.server.failNext("token", { network: true });
    await expect(a.provider.exchangeCode("x", "http://x/cb")).rejects.toMatchObject({ statusCode: 502, code: "OAUTH_PROVIDER_ERROR" });
    const b = make();
    b.server.failNext("token", { status: 200, body: { token_type: "bearer" } });
    await expect(b.provider.exchangeCode("x", "http://x/cb")).rejects.toMatchObject({ statusCode: 502 });
    const c = make();
    c.server.failNext("token", { status: 200, body: "not an object" });
    await expect(c.provider.exchangeCode("x", "http://x/cb")).rejects.toMatchObject({ statusCode: 502 });
  });

  it("never follows redirects with credentials and applies a timeout", async () => {
    let seen: RequestInit | undefined;
    const provider = new GoogleProvider({ ...CREDS, timeoutMs: 1234, fetch: (async (_u: string, init: RequestInit) => { seen = init; return new Response("{}"); }) as never });
    await provider.exchangeCode("x", "http://x/cb").catch(() => {});
    expect(seen?.redirect).toBe("error");
    expect(seen?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("profiles", () => {
  const exchange = async (provider: GoogleProvider | GitHubProvider, server: FakeOAuthServer, name: "google" | "github", identity: FakeIdentity) =>
    provider.fetchProfile(await provider.exchangeCode(server.issueCode(name, identity), "http://x/cb"));

  it("Google maps the OpenID userinfo", async () => {
    const server = new FakeOAuthServer();
    const profile = await exchange(new GoogleProvider({ ...CREDS, fetch: server.fetch }), server, "google", ADA);
    expect(profile).toEqual({ providerUserId: "1001", email: "ada@example.com", emailVerified: true, name: "Ada Lovelace", avatarUrl: "https://img.example/ada.png" });
  });

  it("Google reports unverified e-mails, including the legacy string form", async () => {
    const server = new FakeOAuthServer();
    const google = new GoogleProvider({ ...CREDS, fetch: server.fetch });
    expect((await exchange(google, server, "google", { ...ADA, emailVerified: false })).emailVerified).toBe(false);
    const legacy = new GoogleProvider({ ...CREDS, fetch: (async (u: string) => (u.includes("token") ? new Response(JSON.stringify({ access_token: "t" })) : new Response(JSON.stringify({ sub: "9", email: "a@b.co", email_verified: "true" })))) as never });
    expect((await legacy.fetchProfile(await legacy.exchangeCode("c", "r"))).emailVerified).toBe(true);
  });

  it("Google answers 502 when the profile is unusable", async () => {
    const server = new FakeOAuthServer();
    const google = new GoogleProvider({ ...CREDS, fetch: server.fetch });
    const tokens = await google.exchangeCode(server.issueCode("google", ADA), "http://x/cb");
    server.failNext("profile", { status: 200, body: { email: "a@b.co" } }); // no `sub`
    await expect(google.fetchProfile(tokens)).rejects.toMatchObject({ statusCode: 502 });
  });

  it("GitHub uses the primary *verified* e-mail from the e-mail list", async () => {
    const server = new FakeOAuthServer();
    const gh = new GitHubProvider({ ...CREDS, fetch: server.fetch });
    const profile = await exchange(gh, server, "github", {
      id: "42", name: "Octo",
      emails: [{ email: "old@x.co", primary: false, verified: true }, { email: "main@x.co", primary: true, verified: true }, { email: "pending@x.co", primary: false, verified: false }],
    });
    expect(profile).toMatchObject({ providerUserId: "42", email: "main@x.co", emailVerified: true, name: "Octo" });
  });

  it("GitHub falls back to another verified e-mail when the primary is unverified", async () => {
    const server = new FakeOAuthServer();
    const gh = new GitHubProvider({ ...CREDS, fetch: server.fetch });
    const profile = await exchange(gh, server, "github", { id: "42", emails: [{ email: "main@x.co", primary: true, verified: false }, { email: "alt@x.co", primary: false, verified: true }] });
    expect(profile).toMatchObject({ email: "alt@x.co", emailVerified: true });
  });

  it("GitHub never marks an e-mail verified when none is (or the list is unavailable)", async () => {
    const server = new FakeOAuthServer();
    const gh = new GitHubProvider({ ...CREDS, fetch: server.fetch });
    expect(await exchange(gh, server, "github", { id: "1", emails: [{ email: "x@y.co", primary: true, verified: false }] })).toMatchObject({ email: "x@y.co", emailVerified: false });
    expect(await exchange(gh, server, "github", { id: "2", emails: [] })).toMatchObject({ email: undefined, emailVerified: false });

    const tokens = await gh.exchangeCode(server.issueCode("github", { id: "3", email: "z@y.co" }), "http://x/cb");
    server.requests.length = 0;
    const real = server.fetch;
    const forbidden = new GitHubProvider({ ...CREDS, fetch: ((u: string, i: RequestInit) => (u.endsWith("/emails") ? Promise.resolve(new Response("{}", { status: 403 })) : real(u, i))) as never });
    expect((await forbidden.fetchProfile(tokens)).emailVerified).toBe(false);
  });

  it("GitHub falls back to the login when there is no display name, and sends the API headers it requires", async () => {
    const server = new FakeOAuthServer();
    const gh = new GitHubProvider({ ...CREDS, fetch: server.fetch });
    const profile = await exchange(gh, server, "github", { id: "7", email: "a@b.co" });
    expect(profile.name).toBe("user7");
    const call = server.requests.find((r) => r.url.endsWith("/user"))!;
    expect(call.headers["user-agent"]).toBeTruthy();
    expect(call.headers["x-github-api-version"]).toBe("2022-11-28");
    expect(call.headers.authorization).toMatch(/^Bearer github-access-/);
  });

  it("GitHub answers 502 when the user cannot be read", async () => {
    const server = new FakeOAuthServer();
    const gh = new GitHubProvider({ ...CREDS, fetch: server.fetch });
    const tokens = await gh.exchangeCode(server.issueCode("github", ADA), "http://x/cb");
    server.failNext("profile", { status: 401, body: { message: "Bad credentials" } });
    await expect(gh.fetchProfile(tokens)).rejects.toMatchObject({ statusCode: 502 });
  });
});

/* ───────────────────────── configuration ───────────────────────── */

describe("OAuth configuration", () => {
  const cfg = (oauth: unknown, extra: Record<string, unknown> = {}) =>
    () => new ForgeConfig({ ENV: "test", jwtSecret: TEST_JWT_SECRET, builtinConfig: { auth: testAuthConfig({ oauth }) as never }, ...extra });
  const problems = (fn: () => unknown): string => {
    try { fn(); } catch (e) { return ((e as any).details.problems as string[]).join("\n"); }
    throw new Error("expected a ConfigurationError");
  };

  it("accepts a minimal setup and applies defaults", () => {
    const config = cfg({ providers: [google] })();
    expect(config.auth.oauth).toMatchObject({ accountLinking: "auto", successRedirect: undefined });
    expect(config.auth.oauth!.stateAge.toMs()).toBe(600_000);
    expect(new ForgeConfig({ ENV: "test" }).auth.oauth).toBeUndefined();
  });
  it("requires at least one provider and rejects duplicates", () => {
    expect(problems(cfg({ providers: [] }))).toMatch(/at least one provider/);
    expect(problems(cfg({ providers: [google, google] }))).toMatch(/'google' twice/);
  });
  it("requires client credentials", () => {
    expect(problems(cfg({ providers: [{ provider: "google", clientId: "", clientSecret: "" }] }))).toMatch(/clientId.*\n.*clientSecret/);
  });
  it("only allows redirects to a configured front-end (no open redirect)", () => {
    expect(problems(cfg({ providers: [google], successRedirect: "https://evil.example/x" }, { frontendURL: "https://app.example.com" }))).toMatch(/successRedirect.*not on a configured front-end/);
    expect(problems(cfg({ providers: [google], failureRedirect: "https://app.example.com/e" }))).toMatch(/failureRedirect.*not on a configured front-end/);
    expect(problems(cfg({ providers: [google], successRedirect: "/relative" }, { frontendURL: "https://app.example.com" }))).toMatch(/absolute/);
    expect(problems(cfg({ providers: [google], successRedirect: "javascript:alert(1)" }, { frontendURL: "https://app.example.com" }))).toMatch(/absolute|front-end/);
    expect(cfg({ providers: [google], successRedirect: "https://app.example.com/home", failureRedirect: "https://app.example.com/login" }, { frontendURL: "https://app.example.com/" })).not.toThrow();
  });
  it("validates the linking policy and the state lifetime", () => {
    expect(problems(cfg({ providers: [google], accountLinking: "yolo" }))).toMatch(/accountLinking/);
    expect(problems(cfg({ providers: [google], stateAge: "forever" }))).toMatch(/stateAge/);
  });
  it("needs a strong jwtSecret because it signs the OAuth state", () => {
    expect(problems(() => new ForgeConfig({ ENV: "test", builtinConfig: { auth: { mode: "manual", oauth: { providers: [google] } } } }))).toMatch(/jwtSecret is required/);
  });
  it("fails fast on an unknown built-in provider name when the app is created", () => {
    expect(() => new Forge({ ENV: "test", jwtSecret: TEST_JWT_SECRET, builtinConfig: { auth: testAuthConfig({ oauth: { providers: [{ provider: "myspace", ...CREDS }] } }) as never } }, { dataSource: new InMemoryDataSource() })).toThrow(/Unknown OAuth provider/);
  });
});

/* ───────────────────────── integration: the HTTP flow ───────────────────────── */

describe("provider list and start", () => {
  it("lists the enabled providers for the front-end's buttons", async () => {
    t = await oauthForge();
    const res = await t.client.get("/auth/oauth/providers");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { name: "google", displayName: "Google", url: "/api/v1/auth/oauth/google" },
      { name: "github", displayName: "GitHub", url: "/api/v1/auth/oauth/github" },
    ]);
  });

  it("does not register any OAuth routes unless configured", async () => {
    t = await authForge();
    expect((await t.client.get("/auth/oauth/providers")).status).toBe(404);
    expect((await t.client.get("/auth/oauth/google")).status).toBe(404);
  });

  it("redirects to Google with state and PKCE, and keeps the state in a short-lived HttpOnly Lax cookie", async () => {
    t = await oauthForge();
    const res = await t.client.get("/auth/oauth/google");
    expect(res.status).toBe(302);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const url = new URL(res.headers.get("location")!);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toMatch(/\/api\/v1\/auth\/oauth\/google\/callback$/);
    expect(url.searchParams.get("client_id")).toBe(CREDS.clientId);

    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("forge_oauth_state="))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=600/i);
    // The raw state and verifier are not readable from the cookie value's visible parts.
    expect(decodeURIComponent(cookie)).not.toContain(url.searchParams.get("code_challenge")!);
  });

  it("uses a fresh state and PKCE challenge for every attempt", async () => {
    t = await oauthForge();
    const a = new URL((await t.client.get("/auth/oauth/google")).headers.get("location")!);
    const b = new URL((await t.client.get("/auth/oauth/google")).headers.get("location")!);
    expect(a.searchParams.get("state")).not.toBe(b.searchParams.get("state"));
    expect(a.searchParams.get("code_challenge")).not.toBe(b.searchParams.get("code_challenge"));
  });

  it("answers 404 OAUTH_PROVIDER_NOT_FOUND for providers that are not enabled", async () => {
    t = await oauthForge({ providers: [google] });
    const res = await t.client.get("/auth/oauth/github");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("OAUTH_PROVIDER_NOT_FOUND");
    expect(res.headers.getSetCookie().some((c) => c.startsWith("forge_oauth_state="))).toBe(false);
  });
});

describe("signing in with Google", () => {
  it("creates the account on first sign-in and starts a session", async () => {
    t = await oauthForge();
    const { res, client } = await signIn("google", ADA);
    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Signed in with Google.");
    expect(res.body.data).toMatchObject({ email: "ada@example.com", name: "Ada Lovelace", role: "user" });
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(client.cookies).toHaveProperty("accessToken");
    expect(client.cookies).toHaveProperty("refreshToken");
    expect(users()).toHaveLength(1);
    expect(identities()).toEqual([expect.objectContaining({ provider: "google", providerUserId: "1001", email: "ada@example.com", owner: users()[0]!._id })]);
  });

  it("verifies PKCE end-to-end (the fake server rejects a missing or wrong verifier)", async () => {
    t = await oauthForge();
    await signIn("google", ADA);
    const exchange = t.oauth.requests.find((r) => r.url.includes("oauth2.googleapis.com/token"))!;
    expect(exchange.form!.code_verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(exchange.form!.redirect_uri).toMatch(/\/auth\/oauth\/google\/callback$/);
  });

  it("the new session works: /account/me, refresh rotation and logout", async () => {
    t = await oauthForge();
    const { client } = await signIn("google", ADA);
    expect((await client.get("/account/me")).body.data.email).toBe("ada@example.com");
    expect((await client.post("/auth/refresh-token")).status).toBe(200);
    expect((await client.post("/auth/logout")).status).toBe(200);
    expect((await client.get("/account/me")).status).toBe(401);
    expect(refreshTokenRows(t).length).toBeGreaterThan(0);
  });

  it("recognises the returning user by the provider's id: no duplicate user or identity", async () => {
    t = await oauthForge();
    const first = await signIn("google", ADA);
    const second = await signIn("google", ADA);
    expect(second.res.status).toBe(200);
    expect(second.res.body.data._id).toBe(first.res.body.data._id);
    expect(users()).toHaveLength(1);
    expect(identities()).toHaveLength(1);
  });

  it("identifies users by provider id, not e-mail: a changed e-mail still reaches the same account", async () => {
    t = await oauthForge();
    const first = await signIn("google", ADA);
    const again = await signIn("google", { ...ADA, email: "ada.new@example.com" });
    expect(again.res.body.data._id).toBe(first.res.body.data._id);
    expect(users()).toHaveLength(1);
    expect(users()[0]!.email).toBe("ada@example.com");
  });

  it("normalises e-mail case and matches an existing lowercase account", async () => {
    t = await oauthForge({}, { signupMode: "otp" });
    await seedUser("ada@example.com");
    const { res } = await signIn("google", { ...ADA, email: "Ada@Example.COM" });
    expect(res.status).toBe(200);
    expect(users()).toHaveLength(1);
  });

  it("gives social users an unusable password: they cannot log in with credentials", async () => {
    t = await oauthForge();
    await signIn("google", ADA);
    expect(users()[0]!.password).toMatch(/^\$argon2id\$/);
    const attempt = await login(t.newClient(), "ada@example.com", "anything-at-all-1");
    expect(attempt.status).toBe(401);
    expect(attempt.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("lets a social user set a password later through 'forgot password'", async () => {
    t = await oauthForge();
    await signIn("google", ADA);
    const client = t.newClient();
    await client.post("/auth/forgot-password", { email: "ada@example.com" });
    const verified = await client.post("/auth/verify-otp", { email: "ada@example.com", otp: t.email.lastCode("ada@example.com"), purpose: "password_reset" });
    await client.post("/auth/reset-password", { email: "ada@example.com", resetToken: verified.body.resetToken, password: "Brand-new-pass-9" });
    expect((await login(t.newClient(), "ada@example.com", "Brand-new-pass-9")).status).toBe(200);
  });

  it("never grants elevated roles: new social users get the default role", async () => {
    t = await oauthForge();
    await signIn("google", { ...ADA, name: "admin" });
    expect(users()[0]!.role).toBe("user");
    expect((await t.newClient().get("/admin/check")).status).toBe(401);
  });

  it("recreates the account when the linked local user was deleted", async () => {
    t = await oauthForge();
    const first = await signIn("google", ADA);
    await t.data.repository("User").deleteById(first.res.body.data._id);
    const again = await signIn("google", ADA);
    expect(again.res.status).toBe(201);
    expect(again.res.body.data._id).not.toBe(first.res.body.data._id);
    expect(identities()).toHaveLength(1);
    expect(identities()[0]!.owner).toBe(again.res.body.data._id);
  });
});

describe("signing in with GitHub", () => {
  it("works end-to-end using the verified e-mail from the e-mail list", async () => {
    t = await oauthForge();
    const { res } = await signIn("github", { id: "555", name: "Octo Cat", emails: [{ email: "Octo@Example.com", primary: true, verified: true }] });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email: "octo@example.com", name: "Octo Cat" });
    expect(identities()[0]).toMatchObject({ provider: "github", providerUserId: "555" });
  });

  it("keeps Google and GitHub identities separate but attached to one user (same verified e-mail, OTP sign-up)", async () => {
    t = await oauthForge({}, { signupMode: "otp" });
    const google1 = await signIn("google", ADA);
    const gh = await signIn("github", { id: "999", emails: [{ email: "ada@example.com", primary: true, verified: true }] });
    expect(gh.res.body.data._id).toBe(google1.res.body.data._id);
    expect(users()).toHaveLength(1);
    expect(identities().map((i) => i.provider).sort()).toEqual(["github", "google"]);
  });

  it("does not let provider user ids collide across providers", async () => {
    t = await oauthForge({}, { signupMode: "otp" });
    await signIn("google", { id: "7", email: "a@example.com" });
    await signIn("github", { id: "7", email: "b@example.com" });
    expect(users()).toHaveLength(2);
    expect(identities()).toHaveLength(2);
  });
});

describe("CSRF, replay and tampering protections", () => {
  it("rejects a callback from a browser that never started the flow (login CSRF)", async () => {
    t = await oauthForge();
    const attacker = t.newClient();
    const start = await attacker.get("/auth/oauth/google");
    const attackerCallback = t.oauth.approve(start.headers.get("location")!, ADA);

    // The victim's browser is lured to the attacker's callback URL but has no matching state cookie.
    const victim = t.newClient();
    const res = await victim.get(attackerCallback);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("OAUTH_STATE_INVALID");
    expect(victim.cookies).toEqual({});
    expect(users()).toHaveLength(0);
    expect(t.oauth.requests).toHaveLength(0); // never even contacted the provider
  });

  it("rejects a state parameter that does not match the cookie", async () => {
    t = await oauthForge();
    const client = t.newClient();
    const start = await client.get("/auth/oauth/google");
    const callback = t.oauth.approve(start.headers.get("location")!, ADA).replace(/state=[^&]+/, "state=forged");
    const res = await client.get(callback);
    expect(res.body.code).toBe("OAUTH_STATE_INVALID");
    expect(users()).toHaveLength(0);
  });

  it("rejects a missing state parameter and arrays of states", async () => {
    t = await oauthForge();
    const client = t.newClient();
    const start = await client.get("/auth/oauth/google");
    const code = t.oauth.approve(start.headers.get("location")!, ADA).match(/code=([^&]+)/)![1];
    expect((await client.get(`/auth/oauth/google/callback?code=${code}`)).body.code).toBe("OAUTH_STATE_INVALID");
    expect((await client.get(`/auth/oauth/google/callback?code=${code}&state=a&state=b`)).body.code).toBe("OAUTH_STATE_INVALID");
  });

  it("rejects a state cookie that was issued for a different provider", async () => {
    t = await oauthForge();
    const client = t.newClient();
    const start = await client.get("/auth/oauth/google");
    const callback = t.oauth.approve(start.headers.get("location")!, ADA).replace("/google/", "/github/");
    const res = await client.get(callback);
    expect(res.body.code).toBe("OAUTH_STATE_INVALID");
  });

  it("rejects a tampered or foreign state cookie", async () => {
    t = await oauthForge();
    const client = t.newClient();
    const start = await client.get("/auth/oauth/google");
    const callback = t.oauth.approve(start.headers.get("location")!, ADA);
    client.setCookie("forge_oauth_state", client.cookies.forge_oauth_state!.slice(0, -4) + "AAAA");
    expect((await client.get(callback)).body.code).toBe("OAUTH_STATE_INVALID");

    // An access token is not an OAuth state token either.
    const { accessToken } = (await signIn("github", { id: "1", email: "x@example.com" })).res.body;
    client.setCookie("forge_oauth_state", accessToken);
    expect((await client.get(callback)).body.code).toBe("OAUTH_STATE_INVALID");
  });

  it("expires the flow after stateAge", async () => {
    t = await oauthForge({ stateAge: "1s" });
    const client = t.newClient();
    const start = await client.get("/auth/oauth/google");
    const callback = t.oauth.approve(start.headers.get("location")!, ADA);
    await new Promise((r) => setTimeout(r, 1300));
    expect((await client.get(callback)).body.code).toBe("OAUTH_STATE_INVALID");
  }, 10_000);

  it("clears the state cookie after use, so the same callback cannot be replayed", async () => {
    t = await oauthForge();
    const client = t.newClient();
    const start = await client.get("/auth/oauth/google");
    const callback = t.oauth.approve(start.headers.get("location")!, ADA);
    const stateCookie = client.cookies.forge_oauth_state!;
    expect((await client.get(callback)).status).toBe(201);
    expect(client.cookies.forge_oauth_state).toBeUndefined();
    expect((await client.get(callback)).body.code).toBe("OAUTH_STATE_INVALID");

    // Even with a stolen cookie, the provider's code is single-use.
    client.setCookie("forge_oauth_state", stateCookie);
    const replay = await client.get(callback);
    expect(replay.status).toBe(400);
    expect(replay.body.code).toBe("OAUTH_CODE_INVALID");
    expect(users()).toHaveLength(1);
  });

  it("rejects an authorization code that was bound to a different PKCE verifier (code interception)", async () => {
    t = await oauthForge();
    const client = t.newClient();
    const start = await client.get("/auth/oauth/google");
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const stolen = t.oauth.issueCode("google", ADA, { codeChallenge: pkce.challengeFor("attacker-verifier") });
    const res = await client.get(`/auth/oauth/google/callback?code=${stolen}&state=${state}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("OAUTH_CODE_INVALID");
    expect(users()).toHaveLength(0);
  });

  it("answers 401 OAUTH_ACCESS_DENIED when the user presses Cancel at the provider", async () => {
    t = await oauthForge();
    const client = t.newClient();
    const start = await client.get("/auth/oauth/google");
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const res = await client.get(`/auth/oauth/google/callback?error=access_denied&state=${state}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("OAUTH_ACCESS_DENIED");
    expect(t.oauth.requests).toHaveLength(0);
  });

  it("rejects a missing, oversized or non-string code", async () => {
    t = await oauthForge();
    for (const query of ["", "&code=", `&code=${"x".repeat(3000)}`, "&code=a&code=b"]) {
      const client = t.newClient();
      const state = new URL((await client.get("/auth/oauth/google")).headers.get("location")!).searchParams.get("state")!;
      const res = await client.get(`/auth/oauth/google/callback?state=${state}${query}`);
      expect(res.status, query).toBe(400);
      expect(res.body.code).toBe("OAUTH_CODE_INVALID");
    }
  });
});

describe("e-mail trust", () => {
  it("refuses an unverified e-mail (403) and creates nothing", async () => {
    t = await oauthForge();
    const { res, client } = await signIn("google", { ...ADA, emailVerified: false });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("OAUTH_EMAIL_UNVERIFIED");
    expect(users()).toHaveLength(0);
    expect(identities()).toHaveLength(0);
    expect(client.cookies).toEqual({});
  });

  it("refuses GitHub accounts with no verified e-mail", async () => {
    t = await oauthForge();
    const { res } = await signIn("github", { id: "1", emails: [{ email: "x@y.co", primary: true, verified: false }] });
    expect(res.body.code).toBe("OAUTH_EMAIL_UNVERIFIED");
  });

  it("refuses a profile without any e-mail (400)", async () => {
    t = await oauthForge();
    const { res } = await signIn("github", { id: "1", emails: [] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("OAUTH_EMAIL_MISSING");
    expect(res.body.hint).toMatch(/scope/);
  });
});

describe("linking to existing accounts", () => {
  it("'auto' links to an existing account when sign-up verifies e-mails (OTP sign-up)", async () => {
    t = await oauthForge({}, { signupMode: "otp" });
    const existing = await seedUser();
    const { res } = await signIn("google", ADA);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(existing._id);
    expect(users()).toHaveLength(1);
    expect(identities()).toHaveLength(1);
  });

  it("'auto' blocks linking when sign-up does not verify e-mails: the account pre-hijacking attack", async () => {
    t = await oauthForge({}, { signupMode: "credentials" });
    // The attacker registers the victim's address with a password only they know.
    const attacker = t.newClient();
    await attacker.post("/auth/signup", { name: "Mallory", email: "ada@example.com", password: PASSWORD });

    // The victim later uses "Sign in with Google".
    const { res, client } = await signIn("google", ADA);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ACCOUNT_LINK_BLOCKED");
    expect(client.cookies).toEqual({});
    expect(identities()).toHaveLength(0);
    // The attacker's account is untouched and still has no shared access.
    expect(users()).toHaveLength(1);
    expect(users()[0]!.name).toBe("Mallory");
  });

  it("'always' links anyway (developer accepts the pre-hijacking trade-off)", async () => {
    t = await oauthForge({ accountLinking: "always" }, { signupMode: "credentials" });
    const existing = await seedUser();
    const { res } = await signIn("google", ADA);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(existing._id);
  });

  it("'never' never links, even with verified e-mails", async () => {
    t = await oauthForge({ accountLinking: "never" }, { signupMode: "otp" });
    await seedUser();
    const { res } = await signIn("google", ADA);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ACCOUNT_LINK_BLOCKED");
    expect(res.body.hint).toMatch(/never/);
  });

  it("an already linked identity keeps working under 'never'", async () => {
    t = await oauthForge({ accountLinking: "never" });
    await signIn("google", ADA);
    expect((await signIn("google", ADA)).res.status).toBe(200);
  });
});

describe("new-user data", () => {
  const usernameSchema = () => ({
    mongooseConfig: {
      model: "User",
      schema: { name: fields.requiredString, username: fields.requiredString, email: fields.email, password: fields.password, role: { type: String, default: "user" } as never },
    },
  });

  it("fails clearly (422) when the schema needs fields the provider cannot supply", async () => {
    t = await oauthForge({}, usernameSchema());
    const { res } = await signIn("google", ADA);
    expect(res.status).toBe(422);
    expect(res.body.issues[0].path).toBe("username");
  });

  it("userFromProfile supplies them; Forge still controls e-mail and password", async () => {
    t = await oauthForge({ userFromProfile: (p: OAuthProfile) => ({ username: `u_${p.providerUserId}`, email: "evil@example.com", password: "plain-text-pw" }) }, usernameSchema());
    const { res } = await signIn("google", ADA);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ username: "u_1001", email: "ada@example.com" });
    expect(users()[0]!.password).toMatch(/^\$argon2id\$/);
  });

  it("falls back to the e-mail's local part when the provider has no display name", async () => {
    t = await oauthForge();
    const { res } = await signIn("google", { ...ADA, name: undefined });
    expect(res.body.data.name).toBe("ada");
  });
});

describe("upstream failures", () => {
  it("answers 502 OAUTH_PROVIDER_ERROR when the token call fails, without leaking details", async () => {
    t = await oauthForge();
    const client = t.newClient();
    const start = await client.get("/auth/oauth/google");
    const callback = t.oauth.approve(start.headers.get("location")!, ADA);
    t.oauth.failNext("token", { status: 500 });
    const res = await client.get(callback);
    expect(res.status).toBe(502);
    expect(res.body.code).toBe("OAUTH_PROVIDER_ERROR");
    expect(JSON.stringify(res.body)).not.toMatch(/secret internal detail|test-client-secret/);
    expect(users()).toHaveLength(0);
  });

  it("answers 502 when the profile call fails or the provider is unreachable", async () => {
    t = await oauthForge();
    for (const failure of [{ status: 503 }, { network: true }]) {
      const client = t.newClient();
      const start = await client.get("/auth/oauth/google");
      const callback = t.oauth.approve(start.headers.get("location")!, ADA);
      t.oauth.failNext("profile", failure);
      expect((await client.get(callback)).status).toBe(502);
    }
    expect(users()).toHaveLength(0);
  });
});

describe("redirect mode (browser front-ends)", () => {
  const redirectForge = (extra: Record<string, unknown> = {}) =>
    oauthForge(
      { successRedirect: "https://app.example.com/welcome", failureRedirect: "https://app.example.com/login", ...extra },
      {},
      { frontendURL: "https://app.example.com" },
    );

  it("redirects to the front-end after sign-in with the session in cookies - never in the URL", async () => {
    t = await redirectForge();
    const { res, client } = await signIn("google", ADA);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://app.example.com/welcome");
    expect(client.cookies).toHaveProperty("accessToken");
    expect(res.headers.get("location")).not.toMatch(/token/i);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns to a requested same-site path", async () => {
    t = await redirectForge();
    const client = t.newClient();
    const start = await client.get("/auth/oauth/google?returnTo=%2Fdashboard%3Ftab%3D2");
    const res = await client.get(t.oauth.approve(start.headers.get("location")!, ADA));
    expect(res.headers.get("location")).toBe("https://app.example.com/dashboard?tab=2");
  });

  it.each(["https://evil.example/steal", "//evil.example", "/\\evil.example", "javascript:alert(1)"])("ignores the unsafe returnTo %s (open redirect)", async (target) => {
    t = await redirectForge();
    const client = t.newClient();
    const start = await client.get(`/auth/oauth/google?returnTo=${encodeURIComponent(target)}`);
    const res = await client.get(t.oauth.approve(start.headers.get("location")!, ADA));
    expect(res.headers.get("location")).toBe("https://app.example.com/welcome");
  });

  it("redirects failures to the front-end with only an error code", async () => {
    t = await redirectForge();
    const client = t.newClient();
    const start = await client.get("/auth/oauth/google");
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const denied = await client.get(`/auth/oauth/google/callback?error=access_denied&state=${state}`);
    expect(denied.status).toBe(302);
    expect(denied.headers.get("location")).toBe("https://app.example.com/login?error=OAUTH_ACCESS_DENIED");
    expect(client.cookies.forge_oauth_state).toBeUndefined();
  });

  it("redirects unverified e-mails, provider outages and bad state the same way", async () => {
    t = await redirectForge();
    expect((await signIn("google", { ...ADA, emailVerified: false })).res.headers.get("location")).toBe("https://app.example.com/login?error=OAUTH_EMAIL_UNVERIFIED");

    const client = t.newClient();
    const callback = t.oauth.approve((await client.get("/auth/oauth/google")).headers.get("location")!, ADA);
    t.oauth.failNext("token", { status: 500 });
    expect((await client.get(callback)).headers.get("location")).toBe("https://app.example.com/login?error=OAUTH_PROVIDER_ERROR");

    const stranger = await t.newClient().get("/auth/oauth/google/callback?code=x&state=y");
    expect(stranger.headers.get("location")).toBe("https://app.example.com/login?error=OAUTH_STATE_INVALID");
  });
});

describe("protection of the endpoints", () => {
  it("shares the strict credential rate limit (provider calls cost money and quota)", async () => {
    t = await oauthForge({}, {}, { authMaxReqLimit: 3 });
    for (let i = 0; i < 3; i++) expect((await t.client.get("/auth/oauth/google")).status).toBe(302);
    expect((await t.client.get("/auth/oauth/google")).status).toBe(429);
    expect((await t.client.get("/auth/oauth/providers")).status).toBe(200);
  });

  it("is not blocked by the CSRF origin guard (these are GET navigations)", async () => {
    t = await oauthForge({}, {}, { frontendURL: "https://app.example.com" });
    expect((await t.client.get("/auth/oauth/google", { headers: { origin: "https://accounts.google.com" } })).status).toBe(302);
  });
});

/* ───────────────────────── extensibility ───────────────────────── */

describe("adding your own provider", () => {
  /** A complete provider in ~20 lines: endpoints plus how to read the profile. */
  class DiscordLike extends OAuthProvider {
    readonly name = "discordlike";
    readonly displayName = "DiscordLike";
    protected readonly authorizationEndpoint = "https://discord.test/oauth2/authorize";
    protected readonly tokenEndpoint = "https://discord.test/oauth2/token";
    protected readonly defaultScopes = ["identify", "email"] as const;

    async fetchProfile(tokens: TokenSet): Promise<OAuthProfile> {
      const res = await this.getJson("https://discord.test/users/@me", tokens);
      const me = this.asRecord(res.body);
      if (!res.ok || typeof me.id !== "string") throw this.failure("profile request", res.status);
      return { providerUserId: me.id, email: me.email as string, emailVerified: me.verified === true, name: me.username as string };
    }
  }

  const discordFetch = (user: Record<string, unknown>): typeof fetch =>
    (async (input: string, init?: RequestInit) => {
      if (input.endsWith("/token")) return new Response(JSON.stringify({ access_token: "disc-at", token_type: "Bearer" }));
      return new Response(JSON.stringify(user));
    }) as never;

  it("works through the same flow, with PKCE, state and account rules", async () => {
    const custom = new DiscordLike({ ...CREDS, fetch: discordFetch({ id: "d1", email: "dee@example.com", verified: true, username: "dee" }) });
    t = await oauthForge({ providers: [google, custom] });

    expect((await t.client.get("/auth/oauth/providers")).body.data.map((p: any) => p.name)).toEqual(["google", "discordlike"]);

    const client = t.newClient();
    const start = await client.get("/auth/oauth/discordlike");
    const location = new URL(start.headers.get("location")!);
    expect(location.origin).toBe("https://discord.test");
    expect(location.searchParams.get("scope")).toBe("identify email");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");

    const res = await client.get(`/auth/oauth/discordlike/callback?code=any&state=${location.searchParams.get("state")}`);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email: "dee@example.com", name: "dee" });
    expect(identities()[0]).toMatchObject({ provider: "discordlike", providerUserId: "d1" });
  });

  it("gets the same e-mail verification rule for free", async () => {
    const custom = new DiscordLike({ ...CREDS, fetch: discordFetch({ id: "d2", email: "x@example.com", verified: false, username: "x" }) });
    t = await oauthForge({ providers: [custom] });
    const client = t.newClient();
    const start = await client.get("/auth/oauth/discordlike");
    const state = new URL(start.headers.get("location")!).searchParams.get("state");
    const res = await client.get(`/auth/oauth/discordlike/callback?code=c&state=${state}`);
    expect(res.body.code).toBe("OAUTH_EMAIL_UNVERIFIED");
  });

  it("can be registered on the live registry before the app is built", () => {
    const forge = new Forge({ ENV: "test", jwtSecret: TEST_JWT_SECRET, builtinConfig: { auth: testAuthConfig({ oauth: { providers: [google] } }) as never } }, { dataSource: new InMemoryDataSource() });
    forge.services.oauth.register(new DiscordLike(CREDS));
    expect(forge.services.oauth.list().map((p) => p.name)).toEqual(["google", "discordlike"]);
    expect(() => forge.build()).not.toThrow();
  });
});

describe("manual auth collections", () => {
  it("serve the OAuth routes under their own route name, with callbacks pointing there", async () => {
    t = await createTestForge({
      builtinConfig: { auth: { mode: "manual", oauth: { providers: [google] } } },
      collections: [collection({
        type: "auth", route: "people", model: "Person",
        schema: { name: fields.requiredString, email: fields.email, password: fields.password } as never,
        validations: {},
        routes: [
          { method: "get", path: "/oauth/providers", handler: "oauthProviders", validation: false },
          { method: "get", path: "/oauth/:provider", handler: "oauthStart", validation: false },
          { method: "get", path: "/oauth/:provider/callback", handler: "oauthCallback", validation: false },
        ],
      })],
    });
    const client = t.newClient();
    const start = await client.get("/people/oauth/google");
    expect(new URL(start.headers.get("location")!).searchParams.get("redirect_uri")).toMatch(/\/api\/v1\/people\/oauth\/google\/callback$/);
    const res = await client.get(t.oauth.approve(start.headers.get("location")!, ADA));
    expect(res.status).toBe(201);
    expect(t.data.repository("Person").dump()[0]).toMatchObject({ email: "ada@example.com", name: "Ada Lovelace" });
    expect(t.data.repository(OAUTH_IDENTITY_MODEL).dump()).toHaveLength(1);
  });
});
