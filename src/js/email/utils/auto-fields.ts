import type { AutoDerivedEmailFields } from "./auto-fields.type.js";

/**
 * Minimal request shape required by Forge's auto-derived fields.
 *
 * Framework adapters should map their native request object to this shape.
 * Forge internals remain independent of Express, Fastify, etc.
 */
export interface MinimalRequest {
  ip?: string | undefined;
  ips?: string[] | undefined;

  headers: Record<string, string | string[] | undefined>;

  socket?: {
    remoteAddress?: string | null | undefined;
  };

  connection?: {
    remoteAddress?: string | null | undefined;
  };
}

/**
 * Normalize an IP address.
 *
 * Node may return IPv4 addresses as IPv4-mapped IPv6 addresses:
 *
 *   ::ffff:127.0.0.1
 *   ::ffff:192.168.1.10
 *
 * Converting them makes local/private IP detection much easier.
 */
function normalizeIp(ip: string): string {
  const value = ip.trim();

  if (value.startsWith("::ffff:")) {
    return value.slice(7);
  }

  return value;
}

/**
 * Whether an IP belongs to the local machine.
 */
function isLocalhostIp(ip: string): boolean {
  const normalized = normalizeIp(ip).toLowerCase();

  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "0.0.0.0" ||
    normalized === "::"
  );
}

/**
 * Whether an IPv4 address belongs to a private/local network.
 *
 * Private IPv4 ranges:
 *
 *   10.0.0.0/8
 *   172.16.0.0/12
 *   192.168.0.0/16
 */
function isPrivateIpv4(ip: string): boolean {
  const normalized = normalizeIp(ip);

  const parts = normalized.split(".").map(Number);

  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [a, b] = parts;

  return (
    a === 10 ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && b === 168)
  );
}

/**
 * Whether an IP is a private/local address.
 */
function isPrivateIp(ip: string): boolean {
  const normalized = normalizeIp(ip).toLowerCase();

  // IPv4 private ranges.
  if (isPrivateIpv4(normalized)) {
    return true;
  }

  // IPv6 unique-local addresses: fc00::/7
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) {
    return true;
  }

  // IPv6 link-local: fe80::/10
  if (/^fe[89ab][0-9a-f]{2}:/i.test(normalized)) {
    return true;
  }

  return false;
}

/**
 * Extract a single User-Agent value from the request headers.
 */
function getUserAgent(req: MinimalRequest): string | undefined {
  const value = req.headers["user-agent"];

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
}

/**
 * Client IP address.
 *
 * Priority:
 *
 * 1. x-forwarded-for
 * 2. framework-resolved req.ip
 * 3. req.socket.remoteAddress
 * 4. req.connection.remoteAddress
 *
 * NOTE:
 * x-forwarded-for should only be trusted when your application is behind
 * a trusted proxy/load balancer and proxy trust is configured correctly.
 */
export function getClientIp(req: MinimalRequest): string {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string") {
    const firstIp = forwarded
      .split(",")
      .map((ip) => ip.trim())
      .find(Boolean);

    if (firstIp) {
      return normalizeIp(firstIp);
    }
  }

  if (Array.isArray(forwarded)) {
    const firstIp = forwarded
      .map((ip) => ip.trim())
      .find(Boolean);

    if (firstIp) {
      return normalizeIp(firstIp);
    }
  }

  if (req.ip) {
    return normalizeIp(req.ip);
  }

  if (req.socket?.remoteAddress) {
    return normalizeIp(req.socket.remoteAddress);
  }

  if (req.connection?.remoteAddress) {
    return normalizeIp(req.connection.remoteAddress);
  }

  return "Unknown";
}

/**
 * Human-readable device name derived from User-Agent.
 *
 * This intentionally uses lightweight detection so Forge does not need
 * a UA parsing dependency.
 */
export function getDeviceName(req: MinimalRequest): string {
  const userAgent = getUserAgent(req);

  if (!userAgent) {
    return "Unknown device";
  }

  if (/postmanruntime/i.test(userAgent)) {
    return "Postman";
  }

  if (/ipad/i.test(userAgent)) {
    return "iPad";
  }

  if (/iphone/i.test(userAgent)) {
    return "iPhone";
  }

  if (/android/i.test(userAgent)) {
    if (/mobile/i.test(userAgent)) {
      return "Android phone";
    }

    return "Android device";
  }

  if (/windows phone/i.test(userAgent)) {
    return "Windows phone";
  }

  if (/macintosh|mac os x/i.test(userAgent)) {
    return "Mac";
  }

  if (/windows/i.test(userAgent)) {
    return "Windows PC";
  }

  if (/linux/i.test(userAgent)) {
    return "Linux device";
  }

  return "Unknown device";
}

/**
 * Get a human-readable location for an IP.
 *
 * Localhost:
 *   ::1 / 127.0.0.1 -> "Localhost"
 *
 * Private LAN:
 *   192.168.x.x
 *   10.x.x.x
 *   172.16.x.x - 172.31.x.x
 *
 * These addresses cannot be geolocated because they are not globally
 * routable. We therefore return a useful development/network label.
 *
 * Public IPs require a GeoIP provider/database.
 */
export async function getLocationFromIp(ip: string): Promise<string> {
  if (!ip || ip === "Unknown") {
    return "Unknown location";
  }

  const normalized = normalizeIp(ip);

  if (isLocalhostIp(normalized)) {
    return "Localhost";
  }

  if (isPrivateIp(normalized)) {
    return "Local network";
  }

  // TODO: Add a GeoIP provider here for public IP addresses.
  //
  // Example:
  //
  // const res = await fetch(`https://ipapi.co/${normalized}/json/`);
  // const data = await res.json();
  //
  // if (data.city && data.country_name) {
  //   return `${data.city}, ${data.country_name}`;
  // }

  return "Unknown location";
}

/** Current year for email footer/copyright fields. */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

/**
 * Current date/time formatted for human-readable email fields.
 */
export function getFormattedNow(
  locale = "en-US",
  timeZone?: string,
): string {
  return new Date().toLocaleString(locale, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone,
  });
}

/**
 * Compute all automatically-derived email fields.
 */
export async function getAutoDerivedFields(
  req: MinimalRequest,
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