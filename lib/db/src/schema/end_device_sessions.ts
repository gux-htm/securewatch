import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { devicesTable } from "./devices";

export const endDeviceSessionsTable = pgTable("end_device_sessions", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").references(() => devicesTable.id),
  sessionId: text("session_id").notNull(),
  deviceIp: text("device_ip"),
  userAgent: text("user_agent"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEndDeviceSessionSchema = createInsertSchema(endDeviceSessionsTable).omit({ id: true, startedAt: true });
export type InsertEndDeviceSession = z.infer<typeof insertEndDeviceSessionSchema>;
export type EndDeviceSession = typeof endDeviceSessionsTable.$inferSelect;
