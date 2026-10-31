import type { Request } from "express";
import type { AutoDerivedEmailFields } from "./auto-fields.type.js";

/** The slice of a request needed to derive e-mail fields (keeps this class framework-neutral). */
export type RequestLike = Pick<Request, "ip" | "headers" | "socket">;

const normalizeIp = (ip: string): string => (ip.trim().startsWith("::ffff:") ? ip.trim().slice(7) : ip.trim());

const isLocalhost = (ip: string): boolean => ["127.0.0.1", "::1", "0.0.0.0", "::"].includes(ip.toLowerCase());

const isPrivate = (ip: string): boolean => {
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255)) {
    const [a = 0, b = 0] = parts;
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return /^f[cd][0-9a-f]{2}:/i.test(ip) || /^fe[89ab][0-9a-f]{2}:/i.test(ip);
};

const DEVICE_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/postmanruntime/i, "Postman"],
  [/ipad/i, "iPad"],
  [/iphone/i, "iPhone"],
  [/android.*mobile/i, "Android phone"],
  [/android/i, "Android device"],
  [/windows phone/i, "Windows phone"],
  [/macintosh|mac os x/i, "Mac"],
  [/windows/i, "Windows PC"],
  [/linux/i, "Linux device"],
];

/**
 * Derives the fields the framework can fill in on its own (year, IP, device, location).
 *
 * Unlike 1.x, the client IP comes only from `req.ip`. `X-Forwarded-For` is
 * trusted only if you enabled Express' `trust proxy` (`trustProxy` option),
 * otherwise any caller could forge the IP shown in security e-mails.
 */
export class AutoFields {
  derive(req: RequestLike): AutoDerivedEmailFields {
    const ip = this.clientIp(req);
    return {
      currentYear: new Date().getFullYear(),
      ipAddress: ip,
      deviceName: this.deviceName(req),
      location: this.location(ip),
    };
  }

  clientIp(req: RequestLike): string {
    const ip = req.ip ?? req.socket?.remoteAddress;
    return ip ? normalizeIp(ip) : "Unknown";
  }

  deviceName(req: RequestLike): string {
    const header = req.headers["user-agent"];
    const ua = Array.isArray(header) ? header[0] : header;
    if (!ua) return "Unknown device";
    return DEVICE_RULES.find(([pattern]) => pattern.test(ua))?.[1] ?? "Unknown device";
  }

  /** Public IPs are not geolocated: doing so would send users' IPs to a third party. */
  location(ip: string): string {
    if (!ip || ip === "Unknown") return "Unknown location";
    if (isLocalhost(ip)) return "Localhost";
    if (isPrivate(ip)) return "Local network";
    return "Unknown location";
  }
}
