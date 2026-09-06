import type { AutoDerivedEmailFields } from "./auto-fields.type.js";

/**
 * Minimal shape of an incoming request that we need to read from.
 * Deliberately NOT importing Express/Fastify/etc. types here — this
 * matches Express's `Request`, Fastify's `FastifyRequest`, and Node's
 * raw `IncomingMessage` closely enough that you can pass any of them in
 * without extra adapting.
 */
export interface MinimalRequest {
  ip?: string;
  ips?: string[];
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string | null };
  connection?: { remoteAddress?: string | null };
}

/**
 * Client IP address.
 *
 * - Behind a proxy/load balancer (Vercel, nginx, Cloudflare, etc.) the real
 *   client IP shows up in `x-forwarded-for`, so that's checked first.
 * - Falls back to whatever the framework/runtime already resolved
 *   (`req.ip` in Express with `trust proxy` set), then the raw socket.
 */
export function getClientIp(req: MinimalRequest): string {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }

  return (
    req.ip ??
    req.socket?.remoteAddress ??
    req.connection?.remoteAddress ??
    "Unknown"
  );
}

/**
 * Human-readable device/OS name parsed from the User-Agent header.
 *
 * This is a lightweight heuristic — enough for a security-alert email
 * ("New login from Windows PC"). For real device/browser/OS parsing,
 * swap this out for `ua-parser-js`:
 *
 *   import { UAParser } from "ua-parser-js";
 *   const { browser, os } = UAParser(userAgent);
 *   return `${browser.name ?? "Unknown browser"} on ${os.name ?? "Unknown OS"}`;
 */
export function getDeviceName(req: MinimalRequest): string {
  const rawUserAgent = req.headers["user-agent"];
  const userAgent = Array.isArray(rawUserAgent) ? rawUserAgent[0] : rawUserAgent;

  if (!userAgent) return "Unknown device";
  if (/ipad/i.test(userAgent)) return "iPad";
  if (/iphone/i.test(userAgent)) return "iPhone";
  if (/android/i.test(userAgent)) return "Android device";
  if (/macintosh|mac os x/i.test(userAgent)) return "Mac";
  if (/windows/i.test(userAgent)) return "Windows PC";
  if (/linux/i.test(userAgent)) return "Linux device";

  return "Unknown device";
}

/**
 * Best-effort "City, Country" from an IP address.
 *
 * Ships with no lookup by default (no bundled dependency, no forced
 * network call). Wire up a real provider for production:
 *
 *   Offline DB (no network call, needs periodic updates):
 *     npm i geoip-lite
 *     import geoip from "geoip-lite";
 *     const geo = geoip.lookup(ip);
 *     return geo ? `${geo.city}, ${geo.country}` : "Unknown location";
 *
 *   Hosted API (network call, usually needs an API key):
 *     const res = await fetch(`https://ipapi.co/${ip}/json/`);
 *     const data = await res.json();
 *     return `${data.city}, ${data.country_name}`;
 */
export async function getLocationFromIp(ip: string): Promise<string> {
  if (!ip || ip === "Unknown" || ip === "127.0.0.1" || ip === "::1") {
    return "Unknown location";
  }
  // Plug a real lookup in here — see the examples above.
  return "Unknown location";
}

/** Current year for footer copyright lines. */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

/**
 * "Right now", formatted for a human — for placeholders like `loginTime`,
 * `changeDate`, or `changeTime` that templates name differently but all
 * mean "the moment this action happened". Pass the result under whichever
 * key the specific template expects:
 *
 *   loginAlertEmail({ ..., loginTime: getFormattedNow() })
 *   passwordChangedEmail({ ..., changeDate: getFormattedNow(), changeTime: "" })
 */
export function getFormattedNow(locale = "en-US", timeZone?: string): string {
  return new Date().toLocaleString(locale, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone,
  });
}

/**
 * Convenience aggregator — computes every auto-derivable field in one call.
 * Spread the result straight into an email's placeholder object:
 *
 *   const html = loginAlertEmail({
 *     ...emailConfig,
 *     ...(await getAutoDerivedFields(req)),
 *     userName, confirmLoginUrl, secureAccountUrl, loginTime: getFormattedNow(),
 *   });
 */
export async function getAutoDerivedFields(
  req: MinimalRequest
): Promise<AutoDerivedEmailFields> {
  const ipAddress = getClientIp(req);
  const deviceName = getDeviceName(req);
  const location = await getLocationFromIp(ipAddress);

  return {
    currentYear: getCurrentYear(),
    ipAddress,
    deviceName,
    location,
  };
}
