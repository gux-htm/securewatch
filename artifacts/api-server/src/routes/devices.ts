import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  devicesTable,
  networksTable,
  insertDeviceSchema,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { auditLogsTable } from "@workspace/db/schema";

const router: IRouter = Router();

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

    res.json(withNetwork);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list devices" });
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

    res.status(201).json(device);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to register device" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, Number(req.params.id)));
    if (!device) return res.status(404).json({ error: "Device not found" });
    res.json(device);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get device" });
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

    res.json(device);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update device" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(devicesTable).where(eq(devicesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete device" });
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

    const now = new Date();
    await db.update(devicesTable).set({ lastSeen: now }).where(eq(devicesTable.id, device.id));

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

    res.json({
      allowed,
      reason: allowed
        ? "All credentials match"
        : `Mismatch: mac=${macMatch}, ip=${ipMatch}, cert=${certMatch}`,
      matchedFields: { mac: macMatch, ip: ipMatch, certFingerprint: certMatch },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Verification failed" });
  }
});

export default router;
