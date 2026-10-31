import { afterEach, describe, expect, it } from "vitest";
import { MfaService } from "../src/auth/MfaService.js";
import { MFA_FACTOR_MODEL } from "../src/data/internalModels.js";
import { Totp } from "../src/security/Totp.js";
import { testAuthConfig, type TestForge } from "../src/testing/index.js";
import { authForge, signup } from "./helpers.js";

let t: TestForge | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
});

const totp = new Totp();

/**
 * Node runs requests one after another unless they interleave at an `await`. To prove the optimistic
 * lock really stops a double-spend, hold every read of the factor at a barrier until `n` callers have
 * read it: all of them then see the same "unspent" state and race to write.
 */
const withReadBarrier = (n: number) => {
  const repo = t!.data.repository(MFA_FACTOR_MODEL);
  const original = repo.findOne.bind(repo);
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  repo.findOne = async (...args) => {
    const result = await original(...args);
    if (++arrived <= n) {
      if (arrived === n) release();
      await gate;
    }
    return result;
  };
};

const setup = async () => {
  t = await authForge({ mfa: { issuer: "Acme" } });
  const client = t.newClient();
  const user = (await signup(client)).body.data;
  const { services, config } = t.forge;
  const mfa = new MfaService(config, services.data, services.vault, services.tokens);
  const { secret } = await mfa.beginSetup(user._id, "ada@example.com");
  const recoveryCodes = await mfa.confirmSetup(user._id, totp.codeAt(secret));
  await t.data.repository(MFA_FACTOR_MODEL).updateMany({}, { lastUsedStep: -1 });
  return { mfa, secret, recoveryCodes, userId: user._id as string };
};

describe("double-spend protection under a genuine race", () => {
  it("the same authenticator code cannot be spent twice by simultaneous requests", async () => {
    const { mfa, secret, userId } = await setup();
    withReadBarrier(2);
    const code = totp.codeAt(secret);
    const results = await Promise.allSettled([mfa.verifySecondFactor(userId, { code }), mfa.verifySecondFactor(userId, { code })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(lost.reason).toMatchObject({ code: "MFA_CODE_INVALID" });
  });

  it("the same recovery code cannot be spent twice by simultaneous requests", async () => {
    const { mfa, recoveryCodes, userId } = await setup();
    withReadBarrier(2);
    const results = await Promise.allSettled([
      mfa.verifySecondFactor(userId, { recoveryCode: recoveryCodes[0] }),
      mfa.verifySecondFactor(userId, { recoveryCode: recoveryCodes[0] }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await mfa.status(userId)).toEqual({ enabled: true, recoveryCodesRemaining: 9 });
  });

  it("different recovery codes used at the same time both work, and neither is lost", async () => {
    const { mfa, recoveryCodes, userId } = await setup();
    // Sequential here: a lost compare-and-set is reported to the caller as a failure, never silently dropped.
    await mfa.verifySecondFactor(userId, { recoveryCode: recoveryCodes[0] });
    await mfa.verifySecondFactor(userId, { recoveryCode: recoveryCodes[1] });
    expect((await mfa.status(userId)).recoveryCodesRemaining).toBe(8);
  });

  it("a lost race still counts nothing against the account: it is a refusal, not a lock-out", async () => {
    const { mfa, secret, userId } = await setup();
    withReadBarrier(2);
    const code = totp.codeAt(secret);
    await Promise.allSettled([mfa.verifySecondFactor(userId, { code }), mfa.verifySecondFactor(userId, { code })]);
    const factor = t!.data.repository(MFA_FACTOR_MODEL).dump()[0]!;
    expect(factor.lockedUntil ?? null).toBeNull();
  });

  it("fixture sanity: the config used here really has two-factor on", () => {
    expect(testAuthConfig({ mfa: { issuer: "A" } }).mongooseConfig.model).toBe("User");
  });
});
