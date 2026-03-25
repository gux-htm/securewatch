import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { alertsTable, insertAlertSchema } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const { severity, acknowledged } = req.query;
    const conditions: any[] = [];
    if (severity) conditions.push(eq(alertsTable.severity, severity as any));
    if (acknowledged !== undefined) conditions.push(eq(alertsTable.acknowledged, acknowledged === "true"));

    const alerts = await db
      .select()
      .from(alertsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(alertsTable.createdAt));

    res.json(alerts);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list alerts" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertAlertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const [alert] = await db.insert(alertsTable).values(parsed.data).returning();
    res.status(201).json(alert);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create alert" });
  }
});

router.patch("/:id/acknowledge", async (req, res) => {
  try {
    const { id } = req.params;
    const { acknowledgedBy } = req.body;
    const [alert] = await db
      .update(alertsTable)
      .set({ acknowledged: true, acknowledgedBy: acknowledgedBy || "system", acknowledgedAt: new Date() })
      .where(eq(alertsTable.id, Number(id)))
      .returning();
    if (!alert) return res.status(404).json({ error: "Alert not found" });
    res.json(alert);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

router.post("/bulk-acknowledge", async (req, res) => {
  try {
    const { ids, acknowledgedBy } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids must be a non-empty array" });
    const now = new Date();
    const results = await Promise.all(
      ids.map((id: number) =>
        db.update(alertsTable)
          .set({ acknowledged: true, acknowledgedBy: acknowledgedBy || "system", acknowledgedAt: now })
          .where(eq(alertsTable.id, id))
          .returning()
      )
    );
    res.json({ acknowledged: results.filter(r => r.length > 0).length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to bulk acknowledge" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(alertsTable).where(eq(alertsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete alert" });
  }
});

export default router;
