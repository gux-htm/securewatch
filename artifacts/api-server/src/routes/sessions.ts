import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sessionsTable, auditLogsTable, insertSessionSchema } from "@workspace/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const { search, terminated } = req.query;
    const conditions: any[] = [];
    if (terminated === undefined || terminated === "false") {
      conditions.push(eq(sessionsTable.isTerminated, false));
    }
    if (search) {
      conditions.push(or(
        ilike(sessionsTable.username, `%${search}%`),
        ilike(sessionsTable.ipAddress, `%${search}%`),
        ilike(sessionsTable.deviceFingerprint, `%${search}%`)
      ));
    }
    const sessions = await db
      .select()
      .from(sessionsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sessionsTable.lastActivity);
    res.json(sessions);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = { ...req.body, sessionId: req.body.sessionId || randomUUID() };
    const parsed = insertSessionSchema.safeParse(data);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const [session] = await db.insert(sessionsTable).values(parsed.data).returning();
    res.status(201).json(session);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.post("/:id/terminate", async (req, res) => {
  try {
    const { terminatedBy } = req.body;
    const [session] = await db
      .update(sessionsTable)
      .set({ isTerminated: true, terminatedBy: terminatedBy || "admin" })
      .where(eq(sessionsTable.id, Number(req.params.id)))
      .returning();
    if (!session) return res.status(404).json({ error: "Session not found" });

    await db.insert(auditLogsTable).values({
      eventId: randomUUID(),
      eventType: "session.terminated",
      details: `Session ${session.sessionId} for ${session.username} terminated by ${terminatedBy || "admin"}`,
      ipAddress: session.ipAddress,
      severity: "warning",
    });

    res.json(session);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to terminate session" });
  }
});

export default router;
