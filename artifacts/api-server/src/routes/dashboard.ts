import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  devicesTable,
  networksTable,
  firewallRulesTable,
  idsAlertsTable,
  fileEventsTable,
  auditLogsTable,
} from "@workspace/db/schema";
import { count, eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats", async (req, res) => {
  try {
    const [totalDevices] = await db.select({ value: count() }).from(devicesTable);
    const [activeDevices] = await db.select({ value: count() }).from(devicesTable).where(eq(devicesTable.status, "active"));
    const [blockedDevices] = await db.select({ value: count() }).from(devicesTable).where(eq(devicesTable.status, "blocked"));
    const [totalNetworks] = await db.select({ value: count() }).from(networksTable);
    const [totalFirewallRules] = await db.select({ value: count() }).from(firewallRulesTable);
    const [activeAlerts] = await db.select({ value: count() }).from(idsAlertsTable).where(eq(idsAlertsTable.resolved, false));
    const [criticalAlerts] = await db.select({ value: count() }).from(idsAlertsTable).where(and(eq(idsAlertsTable.severity, "critical"), eq(idsAlertsTable.resolved, false)));
    const [totalFileEvents] = await db.select({ value: count() }).from(fileEventsTable);
    const [recentAuditLogs] = await db.select({ value: count() }).from(auditLogsTable);

    res.json({
      totalDevices: Number(totalDevices.value),
      activeDevices: Number(activeDevices.value),
      blockedDevices: Number(blockedDevices.value),
      totalNetworks: Number(totalNetworks.value),
      totalFirewallRules: Number(totalFirewallRules.value),
      activeAlerts: Number(activeAlerts.value),
      criticalAlerts: Number(criticalAlerts.value),
      totalFileEvents: Number(totalFileEvents.value),
      recentAuditLogs: Number(recentAuditLogs.value),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get dashboard stats" });
  }
});

export default router;
