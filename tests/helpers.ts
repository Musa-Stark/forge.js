import { createTestForge, testAuthConfig, type TestForge } from "../src/testing/index.js";
import type { ForgeOptions } from "../src/config/ForgeOptions.js";
import type { ForgeDependencies } from "../src/core/ServiceFactory.js";
import type { TestClient } from "../src/testing/index.js";
import { OTP_REQUEST_MODEL, REFRESH_TOKEN_MODEL } from "../src/data/internalModels.js";

export const PASSWORD = "Sup3r-secret-pw";

export const authForge = (auth: Record<string, unknown> = {}, extra: ForgeOptions = {}, deps: ForgeDependencies = {}): Promise<TestForge> =>
  createTestForge(
    {
      builtinConfig: {
        auth: testAuthConfig(auth),
        account: { mode: "builtin" },
        admin: { mode: "builtin" },
        email: { companyName: "Forge", companyUrl: "https://forge.test", companyAddress: "1 Test St", supportEmail: "help@forge.test", unsubscribeUrl: "https://forge.test/unsub" },
      },
      ...extra,
    },
    deps,
  );

export const signup = (client: TestClient, email = "ada@example.com", extra: Record<string, unknown> = {}) =>
  client.post("/auth/signup", { name: "Ada", email, password: PASSWORD, ...extra });

export const login = (client: TestClient, email = "ada@example.com", password = PASSWORD) =>
  client.post("/auth/login", { email, password });

/** Registers a user and makes them an administrator directly in the database. */
export const makeAdmin = async (t: TestForge, email = "root@example.com") => {
  const client = t.newClient();
  await signup(client, email, { name: "Root" });
  const user = (await t.data.repository("User").findOne({ email }))!;
  await t.data.repository("User").updateById(user._id, { role: "admin" });
  return client;
};

export const refreshTokenRows = (t: TestForge) => t.data.repository(REFRESH_TOKEN_MODEL).dump();
export const otpRows = (t: TestForge) => t.data.repository(OTP_REQUEST_MODEL).dump();
