import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { fileEventsTable, devicesTable, accountsTable, insertFileEventSchema } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

const eventSelect = {
  id: fileEventsTable.id,
  deviceId: fileEventsTable.deviceId,
  deviceHostname: devicesTable.hostname,
  deviceMac: devicesTable.mac,
  deviceIp: devicesTable.ip,
  userId: fileEventsTable.userId,
  userName: accountsTable.username,
  filePath: fileEventsTable.filePath,
  action: fileEventsTable.action,
  hashBefore: fileEventsTable.hashBefore,
  hashAfter: fileEventsTable.hashAfter,
  userSignature: fileEventsTable.userSignature,
  privilegesUsed: fileEventsTable.privilegesUsed,
  createdAt: fileEventsTable.createdAt,
};

router.get("/latest", async (req, res) => {
  try {
    const latest = await db.execute(sql`
      SELECT
        fe.id, fe.device_id, fe.user_id, fe.file_path, fe.action,
        fe.hash_before, fe.hash_after, fe.user_signature, fe.privileges_used, fe.created_at,
        d.hostname AS device_hostname, d.mac AS device_mac, d.ip AS device_ip,
        a.username AS user_name
      FROM file_events fe
      INNER JOIN (
        SELECT file_path, MAX(id) AS max_id FROM file_events GROUP BY file_path
      ) latest ON fe.id = latest.max_id
      LEFT JOIN devices d ON fe.device_id = d.id
      LEFT JOIN accounts a ON fe.user_id = a.id
      ORDER BY fe.created_at DESC
    `);
    return res.json(latest.rows);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to list latest file events" });
  }
});

router.get("/events", async (req, res) => {
  try {
    const { deviceId, action, limit } = req.query;
    const conditions = [];
    if (deviceId) conditions.push(eq(fileEventsTable.deviceId, Number(deviceId)));
    if (action) conditions.push(eq(fileEventsTable.action, action as "create" | "edit" | "delete" | "rename" | "view"));

    const events = await db
      .select(eventSelect)
      .from(fileEventsTable)
      .leftJoin(devicesTable, eq(fileEventsTable.deviceId, devicesTable.id))
      .leftJoin(accountsTable, eq(fileEventsTable.userId, accountsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(fileEventsTable.createdAt))
      .limit(limit ? Number(limit) : 200);

    return res.json(events);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to list file events" });
  }
});

router.get("/events/history", async (req, res) => {
  try {
    const { filePath, action } = req.query;
    if (!filePath) return res.status(400).json({ error: "filePath query param required" });

    const conditions = [eq(fileEventsTable.filePath, filePath as string)];
    if (action) conditions.push(eq(fileEventsTable.action, action as "create" | "edit" | "delete" | "rename" | "view"));

    const events = await db
      .select(eventSelect)
      .from(fileEventsTable)
      .leftJoin(devicesTable, eq(fileEventsTable.deviceId, devicesTable.id))
      .leftJoin(accountsTable, eq(fileEventsTable.userId, accountsTable.id))
      .where(and(...conditions))
      .orderBy(desc(fileEventsTable.createdAt));

    return res.json(events);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to fetch file history" });
  }
});

router.post("/events", async (req, res) => {
  try {
    const parsed = insertFileEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const [event] = await db.insert(fileEventsTable).values(parsed.data).returning();
    return res.status(201).json(event);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to create file event" });
  }
});

export default router;
