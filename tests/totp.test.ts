import { describe, expect, it } from "vitest";
import { base32, Totp } from "../src/security/Totp.js";

/** RFC 6238 Appendix B: SHA-1, shared secret "12345678901234567890". */
const RFC_SECRET = base32.encode(Buffer.from("12345678901234567890"));

describe("base32 (RFC 4648)", () => {
  it.each([["", ""], ["f", "MY"], ["fo", "MZXQ"], ["foo", "MZXW6"], ["foob", "MZXW6YQ"], ["fooba", "MZXW6YTB"], ["foobar", "MZXW6YTBOI"]])(
    "encodes %j as %s and decodes it back",
    (plain, encoded) => {
      expect(base32.encode(Buffer.from(plain))).toBe(encoded);
      expect(base32.decode(encoded).toString()).toBe(plain);
    },
  );

  it("ignores case, spaces, dashes and padding (how people copy secrets)", () => {
    expect(base32.decode("mzxw 6ytb-oi==").toString()).toBe("foobar");
  });

  it("rejects characters outside the alphabet", () => {
    expect(() => base32.decode("MZXW1")).toThrow(/Invalid base32/);
    expect(() => base32.decode("MZ*W")).toThrow();
  });

  it("round-trips random bytes", () => {
    for (let n = 1; n < 40; n++) {
      const bytes = Buffer.from(Array.from({ length: n }, (_, i) => (i * 37 + n) % 256));
      expect(base32.decode(base32.encode(bytes)).equals(bytes)).toBe(true);
    }
  });
});

describe("Totp", () => {
  const totp = new Totp();

  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ])("matches the RFC 6238 test vector at t=%i", (seconds, expected) => {
    expect(totp.codeAt(RFC_SECRET, seconds * 1000)).toBe(expected);
  });

  it("supports 8-digit codes (RFC vectors)", () => {
    const eight = new Totp({ digits: 8 });
    expect(eight.codeAt(RFC_SECRET, 59_000)).toBe("94287082");
    expect(eight.codeAt(RFC_SECRET, 1111111109_000)).toBe("07081804");
  });

  it("generates 160-bit base32 secrets that differ every time", () => {
    const a = Totp.generateSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32.decode(a)).toHaveLength(20);
    expect(Totp.generateSecret()).not.toBe(a);
  });

  describe("verify", () => {
    const now = 1_700_000_000_000;
    const step = totp.stepAt(now);

    it("accepts the current code and returns its time step", () => {
      expect(totp.verify(RFC_SECRET, totp.codeAt(RFC_SECRET, now), { now })).toBe(step);
    });

    it("tolerates one step of clock drift either way, but no more", () => {
      expect(totp.verify(RFC_SECRET, totp.codeAt(RFC_SECRET, now - 30_000), { now })).toBe(step - 1);
      expect(totp.verify(RFC_SECRET, totp.codeAt(RFC_SECRET, now + 30_000), { now })).toBe(step + 1);
      expect(totp.verify(RFC_SECRET, totp.codeAt(RFC_SECRET, now - 60_000), { now })).toBeUndefined();
      expect(totp.verify(RFC_SECRET, totp.codeAt(RFC_SECRET, now + 60_000), { now })).toBeUndefined();
    });

    it("honours a custom window, including zero", () => {
      const strict = new Totp({ window: 0 });
      expect(strict.verify(RFC_SECRET, strict.codeAt(RFC_SECRET, now - 30_000), { now })).toBeUndefined();
      expect(strict.verify(RFC_SECRET, strict.codeAt(RFC_SECRET, now), { now })).toBe(step);
      const wide = new Totp({ window: 3 });
      expect(wide.verify(RFC_SECRET, wide.codeAt(RFC_SECRET, now - 90_000), { now })).toBe(step - 3);
    });

    it("never accepts a step at or before the last used one (replay protection)", () => {
      const code = totp.codeAt(RFC_SECRET, now);
      expect(totp.verify(RFC_SECRET, code, { now, afterStep: step - 1 })).toBe(step);
      expect(totp.verify(RFC_SECRET, code, { now, afterStep: step })).toBeUndefined();
      expect(totp.verify(RFC_SECRET, code, { now, afterStep: step + 5 })).toBeUndefined();
    });

    it("still finds a newer valid step when an older one was already used", () => {
      const future = totp.codeAt(RFC_SECRET, now + 30_000);
      expect(totp.verify(RFC_SECRET, future, { now, afterStep: step })).toBe(step + 1);
    });

    it("tolerates spaces in what the user typed ('123 456')", () => {
      const code = totp.codeAt(RFC_SECRET, now);
      expect(totp.verify(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, { now })).toBe(step);
    });

    it.each(["", "12345", "1234567", "abcdef", "12345a", "١٢٣٤٥٦", "000000 ", "-12345", "1e5000", "12.456"])("rejects the malformed code %j", (bad) => {
      expect(totp.verify(RFC_SECRET, bad, { now })).toBeUndefined();
    });

    it("rejects a wrong code and a code for another secret", () => {
      const code = totp.codeAt(RFC_SECRET, now);
      const wrong = code === "000000" ? "000001" : "000000";
      expect(totp.verify(RFC_SECRET, wrong, { now })).toBeUndefined();
      expect(totp.verify(Totp.generateSecret(), code, { now })).toBeUndefined();
    });

    it("does not fail at the very start of the epoch", () => {
      expect(totp.verify(RFC_SECRET, totp.codeAt(RFC_SECRET, 0), { now: 0 })).toBe(0);
    });
  });

  it("builds an otpauth URI that authenticator apps understand", () => {
    const url = new URL(totp.otpauthUrl({ secret: "JBSWY3DPEHPK3PXP", issuer: "Acme & Co", account: "ada+test@example.com" }));
    expect(url.protocol).toBe("otpauth:");
    expect(url.hostname).toBe("totp");
    expect(decodeURIComponent(url.pathname)).toBe("/Acme & Co:ada+test@example.com");
    expect(Object.fromEntries(url.searchParams)).toEqual({ secret: "JBSWY3DPEHPK3PXP", issuer: "Acme & Co", algorithm: "SHA1", digits: "6", period: "30" });
  });
});
