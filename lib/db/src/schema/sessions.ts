import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  accountId: integer("account_id"),
  username: text("username").notNull(),
  ipAddress: text("ip_address"),
  deviceFingerprint: text("device_fingerprint"),
  userAgent: text("user_agent"),
  riskVerdict: text("risk_verdict").notNull().default("CLEAN"), // CLEAN | SUSPICIOUS | CRITICAL
  isTerminated: boolean("is_terminated").notNull().default(false),
  terminatedBy: text("terminated_by"),
  lastActivity: timestamp("last_activity", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true, createdAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
