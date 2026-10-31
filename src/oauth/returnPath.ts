/**
 * Accepts a post-login path from the front-end (`?returnTo=/dashboard`) only if it is a plain
 * same-site path. Absolute URLs, protocol-relative `//host`, backslash tricks and control
 * characters are dropped, so the callback can never be turned into an open redirect.
 */
export const safeReturnPath = (value: unknown): string | undefined => {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return undefined;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return undefined;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return undefined;
  try {
    const parsed = new URL(value, "http://forge.invalid");
    return parsed.origin === "http://forge.invalid" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : undefined;
  } catch {
    return undefined;
  }
};
