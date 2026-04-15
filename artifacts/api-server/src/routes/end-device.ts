/**
 * End-Device Portal Routes
 * All routes require the request to originate from the VPN subnet.
 * Provides file listing, reading, and editing for registered mobile devices.
 */
import { Router, type IRouter, type Request } from "express";
import { createHash, randomUUID } from "crypto";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, normalize } from "node:path";

// ─── Encoding helpers ─────────────────────────────────────────────────────────

/**
 * Read a file and return its content as a UTF-8 string regardless of the
 * original encoding. Handles UTF-16 LE (Windows Notepad default), UTF-16 BE,
 * and UTF-8 with or without BOM.
 */
async function readFileAsUtf8(filePath: string): Promise<string> {
  const buf = await readFile(filePath);

  // UTF-16 LE BOM: FF FE
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.slice(2).toString("utf16le");
  }
  // UTF-16 BE BOM: FE FF
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    // Node doesn't have a built-in utf16be decoder; swap bytes then decode
    const swapped = Buffer.alloc(buf.length - 2);
    for (let i = 0; i < swapped.length; i += 2) {
      swapped[i] = buf[i + 3]!;
      swapped[i + 1] = buf[i + 2]!;
    }
    return swapped.toString("utf16le");
  }
  // UTF-8 BOM: EF BB BF
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString("utf8");
  }
  // Default: UTF-8
  return buf.toString("utf8");
}

/**
 * Write content as UTF-8 (no BOM). Always normalises to UTF-8 on save
 * so subsequent reads are consistent regardless of original encoding.
 */
async function writeFileAsUtf8(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, "utf8");
}
import { db } from "@workspace/db";
import {
  devicesTable,
  fileEventsTable,
  auditLogsTable,
} from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireDeviceToken } from "../middlewares/requireDeviceToken.js";

const router: IRouter = Router();

// All end-device routes require a valid device JWT
router.use(requireDeviceToken);

// ─── Types ────────────────────────────────────────────────────────────────────

interface DevicePayload {
  device_id: number;
  mac: string;
  ip: string;
  network_id: number | null;
}

function getDevice(req: Request): DevicePayload {
  return (req as Request & { device: DevicePayload }).device;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve and validate a path is within the allowlisted monitored dirs. */
function resolveAllowedPath(rawPath: string): string | null {
  const monitoredDirs = (process.env["MONITORED_DIRS"] ?? "/etc/omg,/var/lib/omg")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

  // Reject traversal attempts before resolving
  if (rawPath.includes("..")) return null;

  const resolved = normalize(resolve(rawPath));
  for (const dir of monitoredDirs) {
    const base = normalize(resolve(dir));
    if (resolved === base || resolved.startsWith(base + "/")) return resolved;
  }
  return null;
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Find the device record for the calling VPN IP. */
async function deviceByIp(ip: string) {
  const [device] = await db
    .select()
    .from(devicesTable)
    .where(eq(devicesTable.staticIp, ip));
  return device ?? null;
}

// ─── GET /api/end-device/identity ─────────────────────────────────────────────

router.get("/identity", async (req, res) => {
  try {
    const { device_id } = getDevice(req);
    const device = await db.select().from(devicesTable).where(eq(devicesTable.id, device_id)).then(r => r[0] ?? null);
    if (!device) return res.status(404).json({ error: "Device not found" });
    return res.json({
      device_id: device.id,
      mac: device.mac,
      label: device.label ?? device.hostname,
      static_ip: device.staticIp ?? device.ip,
      status: device.status,
      network_id: device.networkId,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to get identity" });
  }
});

// ─── GET /api/end-device/files ────────────────────────────────────────────────

router.get("/files", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        fe.id,
        fe.file_path,
        fe.action        AS event_type,
        fe.hash_before,
        fe.hash_after,
        fe.mac_address,
        fe.ip_address,
        fe.severity,
        fe.privileges_used,
        fe.created_at    AS last_modified,
        d.hostname       AS device_hostname,
        d.cert_fingerprint AS device_signature
      FROM file_events fe
      INNER JOIN (
        SELECT file_path, MAX(id) AS max_id FROM file_events GROUP BY file_path
      ) latest ON fe.id = latest.max_id
      LEFT JOIN devices d ON fe.device_id = d.id
      ORDER BY fe.created_at DESC
    `);
    return res.json(rows.rows);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to list files" });
  }
});

// ─── GET /api/end-device/files/content ────────────────────────────────────────

router.get("/files/content", async (req, res) => {
  try {
    const rawPath = req.query["path"] as string | undefined;
    if (!rawPath) return res.status(400).json({ error: "path query param required" });

    const safePath = resolveAllowedPath(rawPath);
    if (!safePath) return res.status(403).json({ error: "Path not in monitored directories" });
    if (!existsSync(safePath)) return res.status(404).json({ error: "File not found" });

    const content = await readFileAsUtf8(safePath);
    const { device_id, mac, ip } = getDevice(req);

    await db.insert(fileEventsTable).values({
      deviceId: device_id,
      filePath: safePath,
      action: "view",
      hashAfter: sha256(content),
      privilegesUsed: "view",
      macAddress: mac,
      ipAddress: ip,
      severity: "info",
    });

    await db.insert(auditLogsTable).values({
      eventId: randomUUID(),
      deviceId: device_id,
      eventType: "END_DEVICE_ACCESS",
      details: `File viewed: ${safePath}`,
      ipAddress: ip,
      macAddress: mac,
      severity: "info",
    });

    return res.type("text/plain").send(content);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to read file" });
  }
});

// ─── PUT /api/end-device/files/content ────────────────────────────────────────

router.put("/files/content", async (req, res) => {
  try {
    const { path: rawPath, content } = req.body as { path?: unknown; content?: unknown };
    if (typeof rawPath !== "string" || !rawPath) return res.status(400).json({ error: "path is required" });
    if (typeof content !== "string") return res.status(400).json({ error: "content must be a string" });

    const safePath = resolveAllowedPath(rawPath);
    if (!safePath) return res.status(403).json({ error: "Path not in monitored directories" });

    const { device_id, mac, ip } = getDevice(req);

    let hashBefore: string | null = null;
    if (existsSync(safePath)) {
      const existing = await readFileAsUtf8(safePath);
      hashBefore = sha256(existing);
    }

    await writeFileAsUtf8(safePath, content);
    const hashAfter = sha256(content);

    await db.insert(fileEventsTable).values({
      deviceId: device_id,
      filePath: safePath,
      action: "edit",
      hashBefore,
      hashAfter,
      privilegesUsed: "edit",
      macAddress: mac,
      ipAddress: ip,
      severity: "info",
    });

    await db.insert(auditLogsTable).values({
      eventId: randomUUID(),
      deviceId: device_id,
      eventType: "END_DEVICE_FILE_EDIT",
      details: `File edited: ${safePath} — ${hashBefore ?? "new"} → ${hashAfter}`,
      ipAddress: ip,
      macAddress: mac,
      severity: "info",
    });

    return res.json({ ok: true, hash_before: hashBefore, hash_after: hashAfter });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to write file" });
  }
});

// ─── GET /api/end-device/audit ────────────────────────────────────────────────

router.get("/audit", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query["limit"] ?? 5), 50);
    const { device_id } = getDevice(req);

    const logs = await db
      .select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.deviceId, device_id))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limit);

    return res.json(logs);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

export default router;
