import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { policiesTable, insertPolicySchema } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const { deviceId, userId } = req.query;
    const conditions = [];
    if (deviceId) conditions.push(eq(policiesTable.deviceId, Number(deviceId)));
    if (userId) conditions.push(eq(policiesTable.userId, Number(userId)));

    const policies = await db.select().from(policiesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    res.json(policies);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list policies" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertPolicySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const [policy] = await db.insert(policiesTable).values(parsed.data).returning();
    res.status(201).json(policy);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create policy" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { permissions } = req.body;
    const [policy] = await db
      .update(policiesTable)
      .set({ permissions, updatedAt: new Date() })
      .where(eq(policiesTable.id, Number(req.params.id)))
      .returning();
    if (!policy) return res.status(404).json({ error: "Policy not found" });
    res.json(policy);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update policy" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(policiesTable).where(eq(policiesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete policy" });
  }
});

export default router;
