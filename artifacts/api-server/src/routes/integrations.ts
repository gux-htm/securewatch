import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { integrationsTable, insertIntegrationSchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const integrations = await db.select().from(integrationsTable).orderBy(integrationsTable.name);
    res.json(integrations);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list integrations" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertIntegrationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const [integration] = await db.insert(integrationsTable).values(parsed.data).returning();
    res.status(201).json(integration);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create integration" });
  }
});

router.patch("/:id/heartbeat", async (req, res) => {
  try {
    const { status } = req.body;
    const [integration] = await db.update(integrationsTable)
      .set({ status: status || "ACTIVE", lastSeen: new Date() })
      .where(eq(integrationsTable.id, Number(req.params.id)))
      .returning();
    if (!integration) return res.status(404).json({ error: "Integration not found" });
    res.json(integration);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update integration heartbeat" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(integrationsTable).where(eq(integrationsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete integration" });
  }
});

export default router;
