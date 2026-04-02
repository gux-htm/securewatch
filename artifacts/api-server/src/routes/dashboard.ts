import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  devicesTable,
  networksTable,
  firewallRulesTable,
  idsAlertsTable,
  fileEventsTable,
  auditLogsTable,
  alertsTable,
  sessionsTable,
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

router.get("/summary", async (req, res) => {
  try {
    const [criticalAlerts] = await db.select({ value: count() }).from(alertsTable)
      .where(and(eq(alertsTable.severity, "critical"), eq(alertsTable.acknowledged, false)));
    const [unacknowledgedAlerts] = await db.select({ value: count() }).from(alertsTable)
      .where(eq(alertsTable.acknowledged, false));
    const [activeSessions] = await db.select({ value: count() }).from(sessionsTable)
      .where(eq(sessionsTable.isTerminated, false));
    const [trustedDevices] = await db.select({ value: count() }).from(devicesTable)
      .where(eq(devicesTable.status, "active"));
    const [blockedDevices] = await db.select({ value: count() }).from(devicesTable)
      .where(eq(devicesTable.status, "blocked"));
    const [inactiveDevices] = await db.select({ value: count() }).from(devicesTable)
      .where(eq(devicesTable.status, "inactive"));

    res.json({
      criticalAlertCount: Number(criticalAlerts.value),
      unacknowledgedAlertCount: Number(unacknowledgedAlerts.value),
      activeSessionCount: Number(activeSessions.value),
      deviceCounts: {
        trusted: Number(trustedDevices.value),
        blocked: Number(blockedDevices.value),
        inactive: Number(inactiveDevices.value),
      },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get monitoring summary" });
  }
});

export default router;
