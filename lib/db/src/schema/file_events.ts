import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { devicesTable } from "./devices";

export const fileActionEnum = pgEnum("file_action", ["create", "edit", "delete", "rename", "view"]);

export const fileEventsTable = pgTable("file_events", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").references(() => devicesTable.id),
  userId: integer("user_id"),
  filePath: text("file_path").notNull(),
  action: fileActionEnum("action").notNull(),
  hashBefore: text("hash_before"),
  hashAfter: text("hash_after"),
  userSignature: text("user_signature"),
  macAddress: text("mac_address"),
  ipAddress: text("ip_address"),
  privilegesUsed: text("privileges_used"),
  severity: text("severity").notNull().default("info"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFileEventSchema = createInsertSchema(fileEventsTable).omit({ id: true, createdAt: true });
export type InsertFileEvent = z.infer<typeof insertFileEventSchema>;
export type FileEvent = typeof fileEventsTable.$inferSelect;
