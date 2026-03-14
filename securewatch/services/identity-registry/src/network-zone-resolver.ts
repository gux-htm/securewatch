/**
 * NetworkZoneResolver — CIDR-based IP-to-zone lookup.
 * O(log n) via prefix-length sorted matching.
 * Supports IPv4 only (IPv6 extension point noted).
 */

export interface ZoneEntry {
  zone_id:   string;
  zone_name: string;
  cidr:      string; // e.g. "10.0.0.0/8"
}

interface ParsedCidr {
  networkInt: number;
  mask:       number;
  prefixLen:  number;
  zone:       ZoneEntry;
}

function ipToInt(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) return 0;
  return (
    ((parseInt(parts[0] ?? '0', 10) & 0xff) << 24) |
    ((parseInt(parts[1] ?? '0', 10) & 0xff) << 16) |
    ((parseInt(parts[2] ?? '0', 10) & 0xff) << 8)  |
     (parseInt(parts[3] ?? '0', 10) & 0xff)
  ) >>> 0;
}

function parseCidr(cidr: string): { networkInt: number; mask: number; prefixLen: number } | null {
  const [ipPart, lenPart] = cidr.split('/');
  if (!ipPart || !lenPart) return null;
  const prefixLen = parseInt(lenPart, 10);
  if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return null;
  const mask = prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0;
  const networkInt = (ipToInt(ipPart) & mask) >>> 0;
  return { networkInt, mask, prefixLen };
}

export class NetworkZoneResolver {
  private entries: ParsedCidr[] = [];

  /**
   * Load zones — replaces existing entries.
   * Sorted by prefix length descending (most specific first).
   */
  load(zones: ZoneEntry[]): void {
    const parsed: ParsedCidr[] = [];
    for (const zone of zones) {
      const p = parseCidr(zone.cidr);
      if (p) parsed.push({ ...p, zone });
    }
    // Most specific (longest prefix) first — ensures correct match
    parsed.sort((a, b) => b.prefixLen - a.prefixLen);
    this.entries = parsed;
  }

  /**
   * Resolve an IP address to its zone.
   * Returns the most-specific matching zone, or null if no match.
   */
  resolve(ip: string): ZoneEntry | null {
    // Strip IPv6-mapped IPv4 prefix if present
    const cleanIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
    const ipInt = ipToInt(cleanIp);

    for (const entry of this.entries) {
      if ((ipInt & entry.mask) >>> 0 === entry.networkInt) {
        return entry.zone;
      }
    }
    return null;
  }

  get size(): number {
    return this.entries.length;
  }
}
