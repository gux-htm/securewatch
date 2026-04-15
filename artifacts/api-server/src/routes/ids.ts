import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  idsSignaturesTable,
  idsAlertsTable,
  devicesTable,
  insertIdsSignatureSchema,
  insertIdsAlertSchema,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/signatures", async (req, res) => {
  try {
    const sigs = await db.select().from(idsSignaturesTable);
    return res.json(sigs);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to list signatures" });
  }
});

router.post("/signatures", async (req, res) => {
  try {
    const parsed = insertIdsSignatureSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const [sig] = await db.insert(idsSignaturesTable).values(parsed.data).returning();
    return res.status(201).json(sig);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to create signature" });
  }
});

router.get("/alerts", async (req, res) => {
  try {
    const { severity, resolved, limit } = req.query;
    const conditions = [];
    if (severity) conditions.push(eq(idsAlertsTable.severity, severity as "low" | "medium" | "high" | "critical"));
    if (resolved !== undefined) conditions.push(eq(idsAlertsTable.resolved, resolved === "true"));

    const alerts = await db
      .select({
        id: idsAlertsTable.id,
        signatureId: idsAlertsTable.signatureId,
        signatureName: idsSignaturesTable.name,
        deviceId: idsAlertsTable.deviceId,
        deviceHostname: devicesTable.hostname,
        sourceIp: idsAlertsTable.sourceIp,
        destIp: idsAlertsTable.destIp,
        severity: idsAlertsTable.severity,
        action: idsAlertsTable.action,
        payload: idsAlertsTable.payload,
        resolved: idsAlertsTable.resolved,
        resolvedAt: idsAlertsTable.resolvedAt,
        createdAt: idsAlertsTable.createdAt,
      })
      .from(idsAlertsTable)
      .leftJoin(idsSignaturesTable, eq(idsAlertsTable.signatureId, idsSignaturesTable.id))
      .leftJoin(devicesTable, eq(idsAlertsTable.deviceId, devicesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(idsAlertsTable.createdAt))
      .limit(limit ? Number(limit) : 100);

    return res.json(alerts);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to list alerts" });
  }
});

router.post("/alerts", async (req, res) => {
  try {
    const parsed = insertIdsAlertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const [alert] = await db.insert(idsAlertsTable).values(parsed.data).returning();
    return res.status(201).json(alert);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to create alert" });
  }
});

router.post("/alerts/:id/resolve", async (req, res) => {
  try {
    const [alert] = await db
      .update(idsAlertsTable)
      .set({ resolved: true, resolvedAt: new Date() })
      .where(eq(idsAlertsTable.id, Number(req.params.id)))
      .returning();
    if (!alert) return res.status(404).json({ error: "Alert not found" });
    return res.json(alert);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to resolve alert" });
  }
});

export default router;
