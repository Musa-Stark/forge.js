import { describe, expect, it } from "vitest";
import { Duration } from "../src/config/Duration.js";
import { ForgeConfig } from "../src/config/ForgeConfig.js";
import { ConfigurationError } from "../src/errors/index.js";
import fields from "../src/fields/unified.fields.js";
import { generateMasterKey } from "../src/security/CryptoVault.js";
import { TEST_JWT_SECRET } from "../src/testing/createTestForge.js";

const userSchema = { email: fields.email, password: fields.password };
const builtinAuth = (extra = {}) => ({
  auth: { mode: "builtin" as const, mongooseConfig: { model: "User", schema: userSchema }, ...extra },
});

const problemsOf = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigurationError);
    return (error as ConfigurationError).details?.problems as string[];
  }
  throw new Error("expected a ConfigurationError");
};

describe("Duration", () => {
  it.each([
    ["500ms", 500], ["30s", 30_000], ["15m", 900_000], ["1h", 3_600_000],
    ["7d", 604_800_000], ["2w", 1_209_600_000], ["1mo", 2_592_000_000], ["1y", 31_536_000_000], ["1.5h", 5_400_000],
  ])("parses %s", (text, ms) => expect(Duration.parse(text).toMs()).toBe(ms));

  it('treats "0s" as zero (1.x mapped it to one second)', () => {
    expect(Duration.parse("0s").toMs()).toBe(0);
    expect(Duration.parse("0s").isZero()).toBe(true);
  });

  it.each(["", "10", "m", "-5m", "5 minutes", "1x"])("rejects %j", (bad) => {
    expect(() => Duration.parse(bad)).toThrow(ConfigurationError);
  });

  it("accepts numbers and Durations, and computes dates", () => {
    expect(Duration.parse(1500).toSeconds()).toBe(1);
    const d = Duration.parse("1m");
    expect(Duration.parse(d)).toBe(d);
    expect(d.fromNow(1000).getTime()).toBe(61_000);
  });

  it("rejects negative or non-finite numbers", () => {
    expect(() => Duration.ofMs(-1)).toThrow();
    expect(() => Duration.ofMs(Number.NaN)).toThrow();
  });
});

describe("ForgeConfig", () => {
  it("applies sensible defaults", () => {
    const config = new ForgeConfig({ ENV: "test" });
    expect(config.apiPrefix).toBe("/api/v1");
    expect(config.port).toBe(5000);
    expect(config.rateLimit.max).toBe(100);
    expect(config.rateLimit.window.toMs()).toBe(900_000);
    expect(config.pagination).toEqual({ defaultSize: 50, maxSize: 100 });
    expect(config.adminRoles).toEqual(["admin"]);
    expect(config.protectedFields).toEqual(["role"]);
    expect(config.auth.accessTokenAge.toMs()).toBe(600_000);
    expect(config.auth.refreshTokenAge.toMs()).toBe(30 * 86_400_000);
  });

  it("is deeply immutable where it matters", () => {
    const config = new ForgeConfig({ ENV: "test" });
    expect(Object.isFrozen(config.adminRoles)).toBe(true);
    expect(Object.isFrozen(config.collections)).toBe(true);
  });

  it("uses a versioned prefix", () => {
    expect(new ForgeConfig({ apiVersion: 3 }).apiPrefix).toBe("/api/v3");
    expect(problemsOf(() => new ForgeConfig({ apiVersion: 0 }))).toEqual(["apiVersion must be a positive integer."]);
  });

  it("reports every problem at once instead of exiting the process", () => {
    const problems = problemsOf(() => new ForgeConfig({ port: 70000, ENV: "production", isOffline: true, maxReqLimit: -1 }));
    expect(problems.length).toBeGreaterThanOrEqual(3);
    expect(problems.join("\n")).toMatch(/port/);
    expect(problems.join("\n")).toMatch(/isOffline/);
    expect(problems.join("\n")).toMatch(/maxReqLimit/);
  });

  it("requires a database URI when online", () => {
    expect(problemsOf(() => new ForgeConfig({ isOffline: false }))).toContain("mongoDBURI is required when isOffline is false.");
  });

  it("forbids offline mode in production (it prints OTP codes)", () => {
    expect(problemsOf(() => new ForgeConfig({ ENV: "production", isOffline: true, mongoDBURI: "x" })).join()).toMatch(/isOffline/);
  });

  describe("secrets", () => {
    it("requires a strong jwtSecret when authentication is used", () => {
      expect(problemsOf(() => new ForgeConfig({ builtinConfig: builtinAuth() })).join()).toMatch(/jwtSecret is required/);
      expect(problemsOf(() => new ForgeConfig({ jwtSecret: "short", builtinConfig: builtinAuth() })).join()).toMatch(/at least 32/);
      expect(() => new ForgeConfig({ jwtSecret: TEST_JWT_SECRET, builtinConfig: builtinAuth() })).not.toThrow();
    });

    it("does not demand a jwtSecret when no auth is configured", () => {
      expect(() => new ForgeConfig({ ENV: "test" })).not.toThrow();
    });

    it("validates the master key length", async () => {
      expect(problemsOf(() => new ForgeConfig({ masterKey: "abc" })).join()).toMatch(/masterKey/);
      expect(() => new ForgeConfig({ masterKey: undefined })).not.toThrow();
      expect(() => new ForgeConfig({ masterKey: "A".repeat(43) + "=" })).not.toThrow();
      await expect(generateMasterKey()).resolves.toHaveLength(44);
    });
  });

  describe("auth", () => {
    it("requires mongooseConfig in builtin mode and the e-mail/password schema fields", () => {
      expect(problemsOf(() => new ForgeConfig({ jwtSecret: TEST_JWT_SECRET, builtinConfig: { auth: { mode: "builtin" } } })).join()).toMatch(/mongooseConfig is required/);
      const noPassword = { auth: { mode: "builtin" as const, mongooseConfig: { model: "User", schema: { email: fields.email } } } };
      expect(problemsOf(() => new ForgeConfig({ jwtSecret: TEST_JWT_SECRET, builtinConfig: noPassword })).join()).toMatch(/'password' field/);
    });

    it("rejects placeholder values copied from the docs", () => {
      const auth = builtinAuth({ fieldsObj: { email: "[your-email-field]" } });
      expect(problemsOf(() => new ForgeConfig({ jwtSecret: TEST_JWT_SECRET, builtinConfig: auth })).join()).toMatch(/placeholder/);
    });

    it("rejects SameSite=None without secure cookies", () => {
      const auth = builtinAuth({ cookie: { sameSite: "none", secure: false } });
      expect(problemsOf(() => new ForgeConfig({ jwtSecret: TEST_JWT_SECRET, builtinConfig: auth })).join()).toMatch(/sameSite 'none'/);
    });

    it("defaults cookies to Lax outside production and None+Secure in production", () => {
      const dev = new ForgeConfig({ jwtSecret: TEST_JWT_SECRET, builtinConfig: builtinAuth() });
      expect(dev.auth.cookie).toMatchObject({ sameSite: "lax", secure: false });
      const prod = new ForgeConfig({ ENV: "production", isOffline: false, mongoDBURI: "x", jwtSecret: TEST_JWT_SECRET, resendAPIKey: "k", systemEmailSender: "A <a@b.co>", builtinConfig: builtinAuth() });
      expect(prod.auth.cookie).toMatchObject({ sameSite: "none", secure: true });
    });

    it("sets the cookie Domain from auth.cookie.domain", () => {
      const config = new ForgeConfig({ jwtSecret: TEST_JWT_SECRET, builtinConfig: builtinAuth({ cookie: { domain: ".example.com" } }) });
      expect(config.auth.cookie.domain).toBe(".example.com");
      expect(config.warnings.join()).not.toMatch(/deprecated/);
    });

    it("still honours the 1.x top-level `domain` option in production, with a deprecation warning", () => {
      const config = new ForgeConfig({ ENV: "production", isOffline: false, mongoDBURI: "x", jwtSecret: TEST_JWT_SECRET, resendAPIKey: "k", systemEmailSender: "A <a@b.co>", domain: "example.com", builtinConfig: builtinAuth() });
      expect(config.auth.cookie.domain).toBe("example.com");
      expect(config.warnings.join()).toMatch(/domain is deprecated/);
    });

    it("ignores the 1.x `domain` outside production, like 1.x did, but warns", () => {
      const config = new ForgeConfig({ jwtSecret: TEST_JWT_SECRET, domain: "example.com", builtinConfig: builtinAuth() });
      expect(config.auth.cookie.domain).toBeUndefined();
      expect(config.warnings.join()).toMatch(/only applies in production/);
    });

    it("lets auth.cookie.domain win over the legacy `domain`", () => {
      const config = new ForgeConfig({ jwtSecret: TEST_JWT_SECRET, domain: "old.example.com", builtinConfig: builtinAuth({ cookie: { domain: "new.example.com" } }) });
      expect(config.auth.cookie.domain).toBe("new.example.com");
      expect(config.warnings.join()).not.toMatch(/domain is deprecated/);
    });

    it.each(["https://example.com", "example.com:3000", "example.com/path", "exa mple.com", "-bad.com", ""])("rejects the cookie domain %j", (domain) => {
      const auth = builtinAuth({ cookie: { domain } });
      expect(problemsOf(() => new ForgeConfig({ jwtSecret: TEST_JWT_SECRET, builtinConfig: auth })).join()).toMatch(/auth\.cookie\.domain/);
    });

    it("requires e-mail credentials for OTP when online", () => {
      const problems = problemsOf(() => new ForgeConfig({ ENV: "development", isOffline: false, mongoDBURI: "x", jwtSecret: TEST_JWT_SECRET, builtinConfig: builtinAuth() }));
      expect(problems.join()).toMatch(/resendAPIKey/);
      expect(problems.join()).toMatch(/systemEmailSender/);
    });

    it("validates OTP limits and parses OTP durations", () => {
      const cfg = new ForgeConfig({ jwtSecret: TEST_JWT_SECRET, builtinConfig: builtinAuth({ otp: { expiresIn: "2m", maxAttempts: 3 } }) });
      expect(cfg.auth.otp.expiresIn.toMs()).toBe(120_000);
      expect(cfg.auth.otp.maxAttempts).toBe(3);
      expect(problemsOf(() => new ForgeConfig({ jwtSecret: TEST_JWT_SECRET, builtinConfig: builtinAuth({ otp: { maxAttempts: 0 } }) })).join()).toMatch(/maxAttempts/);
    });
  });

  it("validates the system e-mail sender format", () => {
    expect(problemsOf(() => new ForgeConfig({ systemEmailSender: "nope" })).join()).toMatch(/systemEmailSender/);
    expect(() => new ForgeConfig({ systemEmailSender: "Starklabs <noreply@starklabs.com>" })).not.toThrow();
  });

  it("requires Cloudinary credentials only when a route uploads files", () => {
    const withUpload = { type: "crud" as const, route: "p", model: "P", schema: {}, routes: [{ method: "post" as const, path: "/", handler: "create" as const, files: [{ paramField: "a", schemaField: "b" }] }] };
    expect(problemsOf(() => new ForgeConfig({ collections: [withUpload] })).join()).toMatch(/cloudinary/);
    expect(() => new ForgeConfig({ collections: [withUpload], cloudinaryAPIKey: "k", cloudinaryAPISecret: "s", cloudinaryCloudName: "c" })).not.toThrow();
  });

  it("requires a master key when a route encrypts or decrypts fields", async () => {
    const masterKey = await generateMasterKey();
    const withFields = (extra: Record<string, unknown>) => ({
      type: "crud" as const, route: "notes", model: "Note", schema: {},
      routes: [{ method: "post" as const, path: "/", handler: "create" as const, auth: "public" as const, ...extra }],
    });
    for (const extra of [{ encryptedFields: ["secret"] }, { decryptedFields: ["secret?"] }]) {
      expect(problemsOf(() => new ForgeConfig({ collections: [withFields(extra)] })).join()).toMatch(/masterKey is required because a route uses encryptedFields/);
      expect(() => new ForgeConfig({ collections: [withFields(extra)], masterKey })).not.toThrow();
    }
    expect(() => new ForgeConfig({ collections: [withFields({ encryptedFields: [] })] })).not.toThrow();
  });

  it("rejects an inconsistent page size", () => {
    expect(problemsOf(() => new ForgeConfig({ defaultPageSize: 500, maxPageSize: 100 })).join()).toMatch(/defaultPageSize/);
  });

  it("warns about unsafe CORS", () => {
    const config = new ForgeConfig({ corsConfig: { origin: "*", credentials: true } });
    expect(config.warnings.join()).toMatch(/unsafe/);
  });

  it("warns about a missing e-mail config only when real e-mail can go out", () => {
    const mention = /builtinConfig\.email/;
    const online = { ENV: "development", isOffline: false, mongoDBURI: "mongodb://db.example", jwtSecret: TEST_JWT_SECRET, resendAPIKey: "re_test", systemEmailSender: "Acme <hello@acme.example>" };
    const email = { companyName: "Acme", companyUrl: "https://acme.example", companyAddress: "1 Main St", supportEmail: "help@acme.example", unsubscribeUrl: "https://acme.example/unsubscribe" };

    // Nothing sends e-mail, or the app is offline (codes go to the console): no warning.
    expect(new ForgeConfig({}).warnings.join()).not.toMatch(mention);
    expect(new ForgeConfig({ ...online, collections: [] }).warnings.join()).not.toMatch(mention);
    expect(new ForgeConfig({ jwtSecret: TEST_JWT_SECRET, builtinConfig: builtinAuth() }).warnings.join()).not.toMatch(mention);

    // Online with built-in sign-in: warn until the placeholders are given.
    expect(new ForgeConfig({ ...online, builtinConfig: builtinAuth() }).warnings.join()).toMatch(mention);
    expect(new ForgeConfig({ ...online, builtinConfig: { ...builtinAuth(), email } }).warnings.join()).not.toMatch(mention);

    const notify = {
      type: "crud" as const, route: "orders", model: "Order", schema: {},
      routes: [{
        method: "post" as const, path: "/", handler: "create" as const, auth: "public" as const, validation: false,
        actions: { after: [{ emailAction: { from: "system-email-sender", to: "ada@example.com", type: "raw" as const, rawBody: "<p>Thanks</p>", subject: "Thanks" } }] },
      }],
    };
    expect(new ForgeConfig({ ...online, collections: [notify] }).warnings.join()).toMatch(mention);
  });

  it("warns when routes need sign-in but no authentication is configured", () => {
    const route = (auth?: "public" | "authenticated") => ({ method: "get" as const, path: "/", handler: "readAll" as const, ...(auth ? { auth } : {}) });
    const crud = (name: string, auth?: "public" | "authenticated") => ({ type: "crud" as const, route: name, model: "M", schema: {}, routes: [route(auth)] });
    const locked = new ForgeConfig({ collections: [crud("notes", "authenticated"), crud("tags"), crud("posts", "public")] });
    expect(locked.warnings.join()).toMatch(/Collections 'notes', 'tags' have routes that require sign-in/);
    expect(locked.warnings.join()).not.toMatch(/'posts'/);
    expect(new ForgeConfig({ collections: [crud("posts", "public")] }).warnings.join()).not.toMatch(/require sign-in/);
    const withAuth = new ForgeConfig({
      collections: [crud("notes")],
      jwtSecret: "x".repeat(40),
      builtinConfig: { auth: { mode: "builtin", mongooseConfig: { model: "User", schema: { email: fields.email, password: fields.password } } } },
    });
    expect(withAuth.warnings.join()).not.toMatch(/require sign-in/);
  });

  it("builds paths under the prefix", () => {
    expect(new ForgeConfig({}).path("/users/", "me")).toBe("/api/v1/users/me");
  });
});
