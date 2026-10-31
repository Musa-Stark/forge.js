import type { AddressInfo } from "node:net";
import type { ForgeOptions } from "../config/ForgeOptions.js";
import { Forge } from "../core/Forge.js";
import type { ForgeDependencies } from "../core/ServiceFactory.js";
import { generateMasterKey } from "../security/CryptoVault.js";
import fields from "../fields/unified.fields.js";
import { InMemoryDataSource } from "./InMemoryDataSource.js";
import { FakeEmailProvider, FakeStorage } from "./fakes.js";
import { FakeOAuthServer } from "./FakeOAuthServer.js";
import { TestClient } from "./TestClient.js";

export interface TestForge {
  forge: Forge;
  client: TestClient;
  data: InMemoryDataSource;
  email: FakeEmailProvider;
  storage: FakeStorage;
  /** Fake Google/GitHub servers behind the built-in OAuth providers. */
  oauth: FakeOAuthServer;
  url: string;
  /** A fresh client with its own cookie jar (another browser). */
  newClient(): TestClient;
  close(): Promise<void>;
}

export const TEST_JWT_SECRET = "test-secret-test-secret-test-secret-0123456789";

/** A ready-to-use auth configuration for tests. */
export const testAuthConfig = (overrides: Record<string, unknown> = {}) => ({
  mode: "builtin" as const,
  signupMode: "credentials" as const,
  loginMode: "credentials" as const,
  returnAccessToken: true,
  returnRefreshToken: true,
  mongooseConfig: {
    model: "User",
    schema: {
      name: fields.requiredString,
      email: fields.email,
      password: fields.password,
      role: { type: String, default: "user" } as never,
    },
  },
  ...overrides,
});

/**
 * Boots a complete Forge app on a random port with an in-memory database,
 * a fake mailer and fake file storage. Always `await close()` when done.
 */
export const createTestForge = async (options: ForgeOptions = {}, extraDependencies: ForgeDependencies = {}): Promise<TestForge> => {
  // An option that is `undefined` (for example `process.env.JWT_SECRET` in a test run) must not wipe out a test default.
  const given = Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)) as ForgeOptions;
  const data = new InMemoryDataSource();
  const email = new FakeEmailProvider();
  const storage = new FakeStorage();
  const oauth = new FakeOAuthServer();

  const forge = new Forge(
    {
      ENV: "test",
      port: 0,
      isOffline: true,
      jwtSecret: TEST_JWT_SECRET,
      masterKey: await generateMasterKey(),
      authMaxReqLimit: 10_000,
      maxReqLimit: 100_000,
      systemEmailSender: "Forge Tests <noreply@forge.test>",
      builtinConfig: { email: { companyName: "Forge", companyUrl: "https://forge.test", companyAddress: "1 Test St", supportEmail: "help@forge.test", unsubscribeUrl: "https://forge.test/unsub" } },
      ...given,
    },
    { dataSource: data, emailProvider: email, storageProviders: [storage], fetch: oauth.fetch, ...extraDependencies },
  );

  const server = await forge.start();
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const base = `${url}${forge.config.apiPrefix}`;

  return {
    forge,
    client: new TestClient(base),
    data,
    email,
    storage,
    oauth,
    url: base,
    newClient: () => new TestClient(base),
    close: () => forge.stop(),
  };
};
