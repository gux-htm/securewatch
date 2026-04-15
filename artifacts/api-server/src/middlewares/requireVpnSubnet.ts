import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";

/** Parse CIDR string into network address + mask as 32-bit integers. */
function parseCidr(cidr: string): { network: number; mask: number } | null {
  const [addr, bits] = cidr.split("/");
  if (!addr || bits === undefined) return null;
  const prefixLen = parseInt(bits, 10);
  if (Number.isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return null;
  const parts = addr.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => p < 0 || p > 255)) return null;
  const network = (parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!;
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return { network: (network >>> 0) & mask, mask };
}

function isInSubnet(ip: string, cidr: string): boolean {
  const parsed = parseCidr(cidr);
  if (!parsed) return false;
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => p < 0 || p > 255)) return false;
  const ipInt = ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
  return (ipInt & parsed.mask) === parsed.network;
}

/**
 * Middleware: only allow requests originating from the VPN subnet.
 * Also logs every access as an END_DEVICE_ACCESS audit event.
 */
export function requireVpnSubnet(req: Request, res: Response, next: NextFunction): void {
  const vpnSubnet = process.env["VPN_SUBNET"] ?? "10.8.0.0/24";
  // Express sets req.ip; strip IPv6-mapped prefix if present
  const rawIp = req.ip ?? "";
  const clientIp = rawIp.startsWith("::ffff:") ? rawIp.slice(7) : rawIp;

  if (!isInSubnet(clientIp, vpnSubnet)) {
    res.status(403).json({ error: "Access only permitted over VPN" });
    return;
  }

  // Capture session metadata into audit log (fire-and-forget)
  const sessionId = (req.headers["x-session-id"] as string | undefined) ?? randomUUID();
  db.insert(auditLogsTable)
    .values({
      eventId: randomUUID(),
      eventType: "END_DEVICE_ACCESS",
      details: `${req.method} ${req.path}`,
      ipAddress: clientIp,
      severity: "info",
    })
    .catch(() => {/* non-blocking */});

  // Attach session metadata for downstream handlers
  (req as Request & { endDeviceMeta: Record<string, string> }).endDeviceMeta = {
    deviceIp: clientIp,
    sessionId,
    userAgent: req.headers["user-agent"] ?? "",
  };

  next();
}
