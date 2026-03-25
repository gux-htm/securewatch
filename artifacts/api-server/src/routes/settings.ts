import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { settingsTable, SETTINGS_KEYS } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const DEFAULTS: Record<string, string> = {
  [SETTINGS_KEYS.ALERT_THRESHOLD]: "HIGH",
  [SETTINGS_KEYS.SESSION_TIMEOUT]: "60",
  [SETTINGS_KEYS.MFA_ENFORCED]: "false",
  [SETTINGS_KEYS.TENANT_NAME]: "AegisGuard Enterprise SOC",
  [SETTINGS_KEYS.AUDIT_RETENTION]: "90",
  [SETTINGS_KEYS.WEBHOOK_URL]: "",
  [SETTINGS_KEYS.SMTP_HOST]: "",
  [SETTINGS_KEYS.SMTP_PORT]: "587",
  [SETTINGS_KEYS.SMTP_FROM]: "",
  [SETTINGS_KEYS.SMTP_USER]: "",
  [SETTINGS_KEYS.SMTP_PASS]: "",
};

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) { map[row.key] = row.value; }
    res.json(map);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

router.put("/", async (req, res) => {
  try {
    const body = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined) continue;
      const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
      if (existing.length > 0) {
        await db.update(settingsTable).set({ value: String(value), updatedAt: new Date() }).where(eq(settingsTable.key, key));
      } else {
        await db.insert(settingsTable).values({ key, value: String(value) });
      }
    }
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) { map[row.key] = row.value; }
    res.json(map);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
