import { Router, type IRouter } from "express";
import { createHmac, randomUUID } from "crypto";
import { db } from "@workspace/db";
import {
  devicesTable,
  networksTable,
  insertDeviceSchema,
  auditLogsTable,
  ovpnIssuancesTable,
  fileEventsTable,
  endDeviceSessionsTable,
  policiesTable,
} from "@workspace/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { createReadStream, existsSync } from "node:fs";
import { unlink } from "node:fs/promises";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

function normaliseMac(mac: string): string {
  return mac.toUpperCase().replace(/-/g, ":");
}

/** Deterministic device signature: HMAC-SHA256(mac|staticIp|networkId, DEVICE_SIGN_SEED) */
function deviceSignature(mac: string, staticIp: string, networkId: number): string {
  const seed = process.env["DEVICE_SIGN_SEED"] ?? "omg-default-seed";
  const payload = `${mac.toUpperCase()}|${staticIp}|${networkId}`;
  return createHmac("sha256", seed).update(payload).digest("hex");
}

/** Check whether a static IP is within a CIDR subnet. */
function ipInSubnet(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split("/");
  if (!base || !bits) return false;
  const prefixLen = parseInt(bits, 10);
  const toInt = (s: string) =>
    s.split(".").reduce((acc, o) => (acc << 8) | parseInt(o, 10), 0) >>> 0;
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return (toInt(ip) & mask) === (toInt(base) & mask);
}

/** Return the next available IP in a subnet that isn't already assigned. */
async function nextAvailableIp(subnet: string, networkId: number): Promise<string | null> {
  const [base, bits] = subnet.split("/");
  if (!base || !bits) return null;
  const prefixLen = parseInt(bits, 10);
  const toInt = (s: string) =>
    s.split(".").reduce((acc, o) => (acc << 8) | parseInt(o, 10), 0) >>> 0;
  const fromInt = (n: number) =>
    [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join(".");
  const mask = (~0 << (32 - prefixLen)) >>> 0;
  const networkAddr = toInt(base) & mask;
  const broadcast = networkAddr | (~mask >>> 0);

  const existing = await db
    .select({ ip: devicesTable.staticIp })
    .from(devicesTable)
    .where(eq(devicesTable.networkId, networkId));
  const taken = new Set(existing.map((d) => d.ip));

  // Start from .2 (skip .0 network, .1 gateway)
  for (let i = networkAddr + 2; i < broadcast; i++) {
    const candidate = fromInt(i);
    if (!taken.has(candidate)) return candidate;
  }
  return null;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const { networkId, status } = req.query;
    const conditions = [];
    if (networkId) conditions.push(eq(devicesTable.networkId, Number(networkId)));
    if (status) conditions.push(eq(devicesTable.status, status as "active" | "inactive" | "blocked"));

    const devices = await db
      .select()
      .from(devicesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const withNetwork = await Promise.all(
      devices.map(async (d) => {
        if (!d.networkId) return { ...d, networkName: null };
        const [net] = await db.select({ name: networksTable.name }).from(networksTable).where(eq(networksTable.id, d.networkId));
        return { ...d, networkName: net?.name ?? null };
      })
    );

    return res.json(withNetwork);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to list devices" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertDeviceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const [device] = await db.insert(devicesTable).values(parsed.data).returning();

    await db.insert(auditLogsTable).values({
      eventId: randomUUID(),
      deviceId: device.id,
      eventType: "device.registered",
      details: `Device ${device.hostname} (${device.mac}) registered`,
      ipAddress: device.ip,
      macAddress: device.mac,
      severity: "info",
    });

    return res.status(201).json(device);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to register device" });
  }
});

/**
 * POST /api/devices/register
 * Mobile device self-registration. Idempotent — same MAC returns same record.
 */
router.post("/register", async (req, res) => {
  try {
    const body = req.body as {
      mac?: unknown;
      label?: unknown;
      requested_ip?: unknown;
      network_id?: unknown;
    };

    if (typeof body.mac !== "string" || !MAC_RE.test(body.mac)) {
      return res.status(400).json({ error: "Invalid or missing MAC address" });
    }
    if (typeof body.label !== "string" || body.label.length < 1 || body.label.length > 128) {
      return res.status(400).json({ error: "label must be a non-empty string (max 128 chars)" });
    }
    if (typeof body.network_id !== "number" || !Number.isInteger(body.network_id) || body.network_id < 1) {
      return res.status(400).json({ error: "network_id must be a positive integer" });
    }
    const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (body.requested_ip !== undefined && (typeof body.requested_ip !== "string" || !IPV4_RE.test(body.requested_ip))) {
      return res.status(400).json({ error: "requested_ip must be a valid IPv4 address" });
    }

    const rawMac = body.mac;
    const label = body.label;
    const requested_ip = body.requested_ip as string | undefined;
    const network_id = body.network_id;
    const mac = normaliseMac(rawMac);

    // Validate network exists
    const [network] = await db.select().from(networksTable).where(eq(networksTable.id, network_id));
    if (!network) return res.status(404).json({ error: "Network not found" });

    // Idempotent: return existing device if MAC already registered
    const [existing] = await db.select().from(devicesTable).where(eq(devicesTable.mac, mac));
    if (existing) {
      const sig = deviceSignature(mac, existing.staticIp ?? existing.ip, network_id);
      return res.json({
        device_id: existing.id,
        mac: existing.mac,
        static_ip: existing.staticIp ?? existing.ip,
        signature: sig,
        network_id: existing.networkId,
        ovpn_ready: existing.status === "vpn_issued",
      });
    }

    // Validate / assign static IP
    let staticIp: string;
    if (requested_ip) {
      if (!ipInSubnet(requested_ip, network.subnet)) {
        return res.status(400).json({ error: `IP ${requested_ip} is not within subnet ${network.subnet}` });
      }
      // Check not already taken
      const [taken] = await db
        .select()
        .from(devicesTable)
        .where(and(eq(devicesTable.staticIp, requested_ip), ne(devicesTable.mac, mac)));
      if (taken) return res.status(409).json({ error: "Requested IP is already assigned" });
      staticIp = requested_ip;
    } else {
      const auto = await nextAvailableIp(network.subnet, network_id);
      if (!auto) return res.status(409).json({ error: "No available IPs in subnet" });
      staticIp = auto;
    }

    const signature = deviceSignature(mac, staticIp, network_id);

    const [device] = await db
      .insert(devicesTable)
      .values({
        hostname: label,
        mac,
        ip: staticIp,
        staticIp,
        label,
        certFingerprint: signature,
        networkId: network_id,
        status: "pending_vpn",
        platform: "mobile",
      })
      .returning();

    await db.insert(auditLogsTable).values({
      eventId: randomUUID(),
      deviceId: device.id,
      eventType: "device.mobile_registered",
      details: `Mobile device '${label}' (${mac}) registered to network ${network.name}, assigned IP ${staticIp}`,
      ipAddress: staticIp,
      macAddress: mac,
      severity: "info",
    });

    return res.status(201).json({
      device_id: device.id,
      mac: device.mac,
      static_ip: staticIp,
      signature,
      network_id,
      ovpn_ready: false,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Registration failed" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, Number(req.params.id)));
    if (!device) return res.status(404).json({ error: "Device not found" });
    return res.json(device);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to get device" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { status, networkId, ip } = req.body;
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (networkId !== undefined) updates.networkId = networkId;
    if (ip !== undefined) updates.ip = ip;

    const [device] = await db.update(devicesTable).set(updates).where(eq(devicesTable.id, Number(req.params.id))).returning();
    if (!device) return res.status(404).json({ error: "Device not found" });

    if (status === "blocked") {
      await db.insert(auditLogsTable).values({
        eventId: randomUUID(),
        deviceId: device.id,
        eventType: "device.blocked",
        details: `Device ${device.hostname} blocked`,
        ipAddress: device.ip,
        macAddress: device.mac,
        severity: "warning",
      });
    }

    return res.json(device);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to update device" });
  }
});

/**
 * DELETE /api/devices/all
 * Nuclear option — wipe every device and all related records.
 * Requires super_admin role (enforced by caller; no auth middleware here yet).
 */
router.delete("/all", async (req, res) => {
  try {
    await db.delete(endDeviceSessionsTable);
    await db.delete(ovpnIssuancesTable);
    await db.delete(fileEventsTable);
    await db.delete(policiesTable);
    await db.delete(auditLogsTable);
    await db.delete(devicesTable);
    return res.json({ success: true, message: "All devices and related records deleted" });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: String(err) });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid device id" });

    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, id));
    if (!device) return res.status(404).json({ error: "Device not found" });

    await db.delete(endDeviceSessionsTable).where(eq(endDeviceSessionsTable.deviceId, id));
    await db.delete(ovpnIssuancesTable).where(eq(ovpnIssuancesTable.deviceId, id));
    await db.delete(fileEventsTable).where(eq(fileEventsTable.deviceId, id));
    await db.delete(policiesTable).where(eq(policiesTable.deviceId, id));
    await db.delete(auditLogsTable).where(eq(auditLogsTable.deviceId, id));
    await db.delete(devicesTable).where(eq(devicesTable.id, id));

    return res.json({ success: true, deleted_device_id: id });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: String(err) });
  }
});

router.post("/:id/verify", async (req, res) => {
  try {
    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, Number(req.params.id)));
    if (!device) return res.status(404).json({ error: "Device not found" });

    const { mac, ip, certFingerprint } = req.body;
    const macMatch = device.mac === mac;
    const ipMatch = device.ip === ip;
    const certMatch = device.certFingerprint === certFingerprint;
    const allowed = macMatch && ipMatch && certMatch;

    await db.update(devicesTable).set({ lastSeen: new Date() }).where(eq(devicesTable.id, device.id));

    if (!allowed) {
      await db.insert(auditLogsTable).values({
        eventId: randomUUID(),
        deviceId: device.id,
        eventType: "device.verification_failed",
        details: `Zero-trust verification failed for ${device.hostname}: mac=${macMatch}, ip=${ipMatch}, cert=${certMatch}`,
        ipAddress: ip,
        macAddress: mac,
        severity: "critical",
      });
    }

    return res.json({
      allowed,
      reason: allowed ? "All credentials match" : `Mismatch: mac=${macMatch}, ip=${ipMatch}, cert=${certMatch}`,
      matchedFields: { mac: macMatch, ip: ipMatch, certFingerprint: certMatch },
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Verification failed" });
  }
});

/**
 * POST /api/devices/:id/issue-vpn
 * Calls the Python engine to generate a .ovpn file, streams it back as a download.
 * Single-use: marks downloadedAt on first download.
 */
router.post("/:id/issue-vpn", async (req, res) => {
  try {
    const deviceId = Number(req.params.id);
    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, deviceId));
    if (!device) return res.status(404).json({ error: "Device not found" });
    if (device.status !== "pending_vpn") {
      return res.status(409).json({ error: `Device status is '${device.status}', expected 'pending_vpn'` });
    }

    // Call Python FastAPI engine
    const engineUrl = process.env["PYTHON_ENGINE_URL"] ?? "http://localhost:8001";
    const engineRes = await fetch(`${engineUrl}/ovpn/issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: device.id,
        mac: device.mac,
        static_ip: device.staticIp ?? device.ip,
        network_id: device.networkId,
      }),
    });

    if (!engineRes.ok) {
      const body = await engineRes.text();
      req.log.error({ status: engineRes.status, body }, "Python engine error");
      return res.status(502).json({ error: "VPN issuance engine error", detail: body });
    }

    const { ovpn_path, client_cert_fingerprint, cert_serial } = (await engineRes.json()) as {
      ovpn_path: string;
      client_cert_fingerprint: string;
      cert_serial: string;
    };

    if (!existsSync(ovpn_path)) {
      return res.status(500).json({ error: "OVPN file not found after generation" });
    }

    // Record issuance
    const [issuance] = await db
      .insert(ovpnIssuancesTable)
      .values({
        deviceId: device.id,
        networkId: device.networkId!,
        commonName: `omg-device-${device.id}`,
        certSerial: cert_serial,
        clientCertFingerprint: client_cert_fingerprint,
        downloadedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      })
      .returning();

    // Update device status
    await db.update(devicesTable).set({ status: "vpn_issued" }).where(eq(devicesTable.id, deviceId));

    await db.insert(auditLogsTable).values({
      eventId: randomUUID(),
      deviceId: device.id,
      eventType: "device.vpn_issued",
      details: `OVPN config issued for device ${device.hostname} (${device.mac}), issuance #${issuance.id}`,
      ipAddress: device.staticIp ?? device.ip,
      macAddress: device.mac,
      severity: "info",
    });

    // Stream the file, then schedule deletion (5 min)
    res.setHeader("Content-Type", "application/x-openvpn-profile");
    res.setHeader("Content-Disposition", `attachment; filename="omg-${deviceId}.ovpn"`);

    const stream = createReadStream(ovpn_path);
    stream.pipe(res);
    stream.on("end", () => {
      setTimeout(() => unlink(ovpn_path).catch(() => {}), 5 * 60 * 1000);
    });
    return;
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "VPN issuance failed" });
  }
});

/**
 * POST /api/devices/:id/approve
 * Network Monitor approves a pending_vpn device.
 * Generates HMAC-SHA256 signature, sets status to active.
 */
router.post("/:id/approve", async (req, res) => {
  try {
    const deviceId = Number(req.params.id);
    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, deviceId));
    if (!device) return res.status(404).json({ error: "Device not found" });

    const pendingStatuses = ["pending_vpn", "pending_approval"];
    if (!pendingStatuses.includes(device.status)) {
      return res.status(409).json({ error: `Device is already '${device.status}', not pending` });
    }

    const staticIp = device.staticIp ?? device.ip;
    const networkId = device.networkId;
    if (!networkId) return res.status(400).json({ error: "Device has no network assigned" });

    // For new-style registrations (pending_approval), set to approved_awaiting_setup
    // so the phone can create username/password/passkey before going active.
    // For legacy pending_vpn, go straight to active.
    const nextStatus = device.status === "pending_approval" ? "approved_awaiting_setup" : "active";

    const [updated] = await db
      .update(devicesTable)
      .set({ status: nextStatus })
      .where(eq(devicesTable.id, deviceId))
      .returning();

    await db.insert(auditLogsTable).values({
      eventId: randomUUID(),
      deviceId: device.id,
      eventType: "device.approved",
      details: `Device '${device.hostname}' (${device.mac}) approved. Status → ${nextStatus}`,
      ipAddress: staticIp,
      macAddress: device.mac,
      severity: "info",
    });

    return res.json({
      device_id: updated.id,
      mac: updated.mac,
      ip: staticIp,
      status: updated.status,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Approval failed" });
  }
});

export default router;
