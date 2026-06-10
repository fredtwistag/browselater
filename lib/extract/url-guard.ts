/**
 * SSRF guard: reject server-side fetches that target private, internal, or
 * non-http(s) locations. Called at every fetch boundary that takes a
 * user-supplied URL (and at every redirect hop in resolveCanonical).
 *
 * Note: this does NOT defend against DNS rebinding (a public hostname that
 * resolves to a private IP) — that needs resolve-then-pin, which standard
 * `fetch` doesn't expose. Documented as accepted residual risk in plan 006.
 */

export class PrivateUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivateUrlError";
  }
}

function ip4ToInt(a: number, b: number, c: number, d: number): number {
  return (a * 2 ** 24 + b * 2 ** 16 + c * 2 ** 8 + d) >>> 0;
}

// (network base, mask) pairs for private/reserved IPv4 ranges, as 32-bit ints.
const IPV4_BLOCKED: Array<[number, number]> = [
  [ip4ToInt(0, 0, 0, 0), 0xff000000], // 0.0.0.0/8
  [ip4ToInt(10, 0, 0, 0), 0xff000000], // 10.0.0.0/8
  [ip4ToInt(100, 64, 0, 0), 0xffc00000], // 100.64.0.0/10 (CGNAT)
  [ip4ToInt(127, 0, 0, 0), 0xff000000], // 127.0.0.0/8 (loopback)
  [ip4ToInt(169, 254, 0, 0), 0xffff0000], // 169.254.0.0/16 (link-local / cloud metadata)
  [ip4ToInt(172, 16, 0, 0), 0xfff00000], // 172.16.0.0/12
  [ip4ToInt(192, 168, 0, 0), 0xffff0000], // 192.168.0.0/16
  [ip4ToInt(198, 18, 0, 0), 0xfffe0000], // 198.18.0.0/15 (benchmarking)
];

function isBlockedIpv4(ipInt: number): boolean {
  return IPV4_BLOCKED.some(([base, mask]) => (ipInt & mask) >>> 0 === base);
}

/** Expand an IPv6 address (inside-brackets form) to 16 bytes, or null if unparseable. */
function ipv6ToBytes(input: string): number[] | null {
  let s = input.toLowerCase();

  // Defensive: handle a dotted-IPv4 tail (the URL parser normally rewrites this
  // to hex groups, but accept it anyway).
  const lastColon = s.lastIndexOf(":");
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) {
    const parts = tail.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return null;
    }
    const hi = ((parts[0] << 8) | parts[1]).toString(16);
    const lo = ((parts[2] << 8) | parts[3]).toString(16);
    s = `${s.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const halves = s.split("::");
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(":") : [];
  let groups: string[];
  if (halves.length === 2) {
    const back = halves[1] ? halves[1].split(":") : [];
    const missing = 8 - head.length - back.length;
    if (missing < 0) return null;
    groups = [...head, ...Array<string>(missing).fill("0"), ...back];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const val = parseInt(g, 16);
    bytes.push((val >> 8) & 0xff, val & 0xff);
  }
  return bytes;
}

function assertPublicIpv6(inner: string): void {
  const bytes = ipv6ToBytes(inner);
  if (!bytes) throw new PrivateUrlError(`unparseable ipv6: ${inner}`);

  // :: (unspecified) and ::1 (loopback)
  if (bytes.slice(0, 15).every((b) => b === 0) && (bytes[15] === 0 || bytes[15] === 1)) {
    throw new PrivateUrlError(`loopback/unspecified ipv6: ${inner}`);
  }
  // fc00::/7 (unique-local)
  if ((bytes[0] & 0xfe) === 0xfc) throw new PrivateUrlError(`unique-local ipv6: ${inner}`);
  // fe80::/10 (link-local)
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) {
    throw new PrivateUrlError(`link-local ipv6: ${inner}`);
  }
  // IPv4-mapped (::ffff:a.b.c.d) — apply the IPv4 rules to the embedded address.
  const v4Mapped =
    bytes.slice(0, 10).every((b) => b === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  if (v4Mapped && isBlockedIpv4(ip4ToInt(bytes[12], bytes[13], bytes[14], bytes[15]))) {
    throw new PrivateUrlError(`private ipv4-mapped ipv6: ${inner}`);
  }
}

/** Throws PrivateUrlError if the URL targets a private/internal/non-http location. */
export function assertPublicUrl(input: string): void {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new PrivateUrlError(`invalid url: ${input}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PrivateUrlError(`disallowed protocol: ${url.protocol}`);
  }

  const host = url.hostname.toLowerCase();
  if (!host) throw new PrivateUrlError("empty host");

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new PrivateUrlError(`private host: ${host}`);
  }

  // IPv6 literal: URL.hostname keeps the brackets, e.g. "[::1]".
  if (host.startsWith("[") && host.endsWith("]")) {
    assertPublicIpv6(host.slice(1, -1));
    return;
  }

  // IPv4 dotted-quad. The URL parser normalizes shorthand (127.1, 0x7f.1,
  // 2130706433) to this canonical form before we see it.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const octets = host.split(".").map(Number);
    if (octets.some((o) => o > 255)) throw new PrivateUrlError(`invalid ipv4: ${host}`);
    if (isBlockedIpv4(ip4ToInt(octets[0], octets[1], octets[2], octets[3]))) {
      throw new PrivateUrlError(`private ipv4: ${host}`);
    }
    return;
  }

  // Public DNS name or public IP literal — allowed.
}
