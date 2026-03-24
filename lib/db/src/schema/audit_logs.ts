import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { devicesTable } from "./devices";

export const auditSeverityEnum = pgEnum("audit_severity", ["info", "warning", "error", "critical"]);

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull().unique(),
  deviceId: integer("device_id").references(() => devicesTable.id),
  userId: integer("user_id"),
  eventType: text("event_type").notNull(),
  details: text("details"),
  ipAddress: text("ip_address"),
  macAddress: text("mac_address"),
  severity: auditSeverityEnum("severity").notNull().default("info"),
  serverSignature: text("server_signature"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
