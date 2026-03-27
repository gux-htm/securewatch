import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { fileEventsTable, devicesTable, insertFileEventSchema } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/events", async (req, res) => {
  try {
    const { deviceId, action, limit } = req.query;
    const conditions = [];
    if (deviceId) conditions.push(eq(fileEventsTable.deviceId, Number(deviceId)));
    if (action) conditions.push(eq(fileEventsTable.action, action as "create" | "edit" | "delete" | "rename" | "view"));

    const events = await db
      .select({
        id: fileEventsTable.id,
        deviceId: fileEventsTable.deviceId,
        deviceHostname: devicesTable.hostname,
        userId: fileEventsTable.userId,
        filePath: fileEventsTable.filePath,
        action: fileEventsTable.action,
        hashBefore: fileEventsTable.hashBefore,
        hashAfter: fileEventsTable.hashAfter,
        userSignature: fileEventsTable.userSignature,
        privilegesUsed: fileEventsTable.privilegesUsed,
        createdAt: fileEventsTable.createdAt,
      })
      .from(fileEventsTable)
      .leftJoin(devicesTable, eq(fileEventsTable.deviceId, devicesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(fileEventsTable.createdAt))
      .limit(limit ? Number(limit) : 100);

    res.json(events);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list file events" });
  }
});

router.post("/events", async (req, res) => {
  try {
    const parsed = insertFileEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const [event] = await db.insert(fileEventsTable).values(parsed.data).returning();
    res.status(201).json(event);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create file event" });
  }
});

export default router;
