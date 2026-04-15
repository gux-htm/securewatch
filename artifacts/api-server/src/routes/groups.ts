import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { groupsTable, groupMembersTable } from "@workspace/db/schema";
import { eq, and, count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const groups = await db.select().from(groupsTable).orderBy(groupsTable.name);
    const withCounts = await Promise.all(groups.map(async (g) => {
      const [{ value }] = await db.select({ value: count() }).from(groupMembersTable).where(eq(groupMembersTable.groupId, g.id));
      return { ...g, memberCount: Number(value) };
    }));
    return res.json(withCounts);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to list groups" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name) return res.status(400).json({ error: "name is required" });
    const [group] = await db.insert(groupsTable).values({ name, description }).returning();
    return res.status(201).json(group);
  } catch (err: unknown) {
    req.log.error(err);
    if ((err as { code?: string }).code === "23505") return res.status(409).json({ error: "Group name already exists" });
    return res.status(500).json({ error: "Failed to create group" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(groupsTable).where(eq(groupsTable.id, Number(req.params.id)));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to delete group" });
  }
});

router.get("/:id/members", async (req, res) => {
  try {
    const members = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, Number(req.params.id)));
    return res.json(members);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to list members" });
  }
});

router.post("/:id/members", async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    const { accountId, username } = req.body as { accountId?: number; username?: string };
    if (!accountId || !username) return res.status(400).json({ error: "accountId and username are required" });

    const existing = await db.select().from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.accountId, accountId)));
    if (existing.length > 0) return res.status(409).json({ error: "Member already in group" });

    const [member] = await db.insert(groupMembersTable).values({ groupId, accountId, username }).returning();
    return res.status(201).json(member);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to add member" });
  }
});

router.delete("/:id/members/:memberId", async (req, res) => {
  try {
    await db.delete(groupMembersTable).where(eq(groupMembersTable.id, Number(req.params.memberId)));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Failed to remove member" });
  }
});

export default router;
