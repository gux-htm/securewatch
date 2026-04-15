import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { resourcesTable, aclEntriesTable, insertResourceSchema, insertAclEntrySchema } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const { archived } = req.query;
    const resources = await db.select().from(resourcesTable)
      .where(archived === undefined ? eq(resourcesTable.archived, false) : undefined)
      .orderBy(resourcesTable.name);
    return res.json(resources);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to list resources" });
  }
});

router.post("/", async (req, res) => {
  try {
    const parsed = insertResourceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const [resource] = await db.insert(resourcesTable).values(parsed.data).returning();
    return res.status(201).json(resource);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to create resource" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const allowed = ["name", "path", "description", "currentHash", "archived"] as const;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of allowed) {
      if ((req.body as Record<string, unknown>)[k] !== undefined) {
        updates[k] = (req.body as Record<string, unknown>)[k];
      }
    }
    const [resource] = await db.update(resourcesTable).set(updates)
      .where(eq(resourcesTable.id, Number(req.params.id))).returning();
    if (!resource) return res.status(404).json({ error: "Resource not found" });
    return res.json(resource);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to update resource" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(resourcesTable).where(eq(resourcesTable.id, Number(req.params.id)));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to delete resource" });
  }
});

router.get("/:id/acl", async (req, res) => {
  try {
    const acl = await db.select().from(aclEntriesTable).where(eq(aclEntriesTable.resourceId, Number(req.params.id)));
    return res.json(acl);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to list ACL entries" });
  }
});

router.post("/:id/acl", async (req, res) => {
  try {
    const data = { ...(req.body as Record<string, unknown>), resourceId: Number(req.params.id) };
    const parsed = insertAclEntrySchema.safeParse(data);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const [entry] = await db.insert(aclEntriesTable).values(parsed.data).returning();
    return res.status(201).json(entry);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to create ACL entry" });
  }
});

router.patch("/:id/acl/:entryId/revoke", async (req, res) => {
  try {
    const [entry] = await db.update(aclEntriesTable)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(eq(aclEntriesTable.id, Number(req.params.entryId)))
      .returning();
    if (!entry) return res.status(404).json({ error: "ACL entry not found" });
    return res.json(entry);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to revoke ACL entry" });
  }
});

export default router;
