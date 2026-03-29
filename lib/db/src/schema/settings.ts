import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Typed helper to get/set settings
export const SETTINGS_KEYS = {
  ALERT_THRESHOLD: "alert_threshold",        // CRITICAL | HIGH | MEDIUM | LOW | INFO
  SESSION_TIMEOUT: "session_timeout",         // minutes
  MFA_ENFORCED: "mfa_enforced",              // true | false
  TENANT_NAME: "tenant_name",               // string
  AUDIT_RETENTION: "audit_retention_days",   // days
  WEBHOOK_URL: "webhook_url",               // URL
  SMTP_HOST: "smtp_host",
  SMTP_PORT: "smtp_port",
  SMTP_FROM: "smtp_from",
  SMTP_USER: "smtp_user",
  SMTP_PASS: "smtp_pass",
} as const;

export type SettingKey = typeof SETTINGS_KEYS[keyof typeof SETTINGS_KEYS];
