import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { auditLogsTable, devicesTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/logs", async (req, res) => {
  try {
    const { deviceId, eventType, limit, offset } = req.query;
    const conditions = [];
    if (deviceId) conditions.push(eq(auditLogsTable.deviceId, Number(deviceId)));
    if (eventType) conditions.push(eq(auditLogsTable.eventType, String(eventType)));

    const logs = await db
      .select({
        id: auditLogsTable.id,
        eventId: auditLogsTable.eventId,
        deviceId: auditLogsTable.deviceId,
        deviceHostname: devicesTable.hostname,
        userId: auditLogsTable.userId,
        eventType: auditLogsTable.eventType,
        details: auditLogsTable.details,
        ipAddress: auditLogsTable.ipAddress,
        macAddress: auditLogsTable.macAddress,
        severity: auditLogsTable.severity,
        serverSignature: auditLogsTable.serverSignature,
        createdAt: auditLogsTable.createdAt,
      })
      .from(auditLogsTable)
      .leftJoin(devicesTable, eq(auditLogsTable.deviceId, devicesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limit ? Number(limit) : 100)
      .offset(offset ? Number(offset) : 0);

    res.json(logs);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list audit logs" });
  }
});

export default router;
