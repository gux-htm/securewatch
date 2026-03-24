import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { firewallRulesTable, insertFirewallRuleSchema } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/rules", async (req, res) => {
  try {
    const { networkId, deviceId } = req.query;
    const conditions = [];
    if (networkId) conditions.push(eq(firewallRulesTable.networkId, Number(networkId)));
    if (deviceId) conditions.push(eq(firewallRulesTable.deviceId, Number(deviceId)));

    const rules = await db.select().from(firewallRulesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    res.json(rules);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list firewall rules" });
  }
});

router.post("/rules", async (req, res) => {
  try {
    const parsed = insertFirewallRuleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const [rule] = await db.insert(firewallRulesTable).values(parsed.data).returning();
    res.status(201).json(rule);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create firewall rule" });
  }
});

router.patch("/rules/:id", async (req, res) => {
  try {
    const { action, enabled, priority, description } = req.body;
    const updates: Record<string, unknown> = {};
    if (action !== undefined) updates.action = action;
    if (enabled !== undefined) updates.enabled = enabled;
    if (priority !== undefined) updates.priority = priority;
    if (description !== undefined) updates.description = description;

    const [rule] = await db.update(firewallRulesTable).set(updates)
      .where(eq(firewallRulesTable.id, Number(req.params.id))).returning();
    if (!rule) return res.status(404).json({ error: "Rule not found" });
    res.json(rule);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update firewall rule" });
  }
});

router.delete("/rules/:id", async (req, res) => {
  try {
    await db.delete(firewallRulesTable).where(eq(firewallRulesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete firewall rule" });
  }
});

export default router;
