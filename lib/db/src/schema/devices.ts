import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { networksTable } from "./networks";

export const deviceStatusEnum = pgEnum("device_status", ["active", "inactive", "blocked"]);

export const devicesTable = pgTable("devices", {
  id: serial("id").primaryKey(),
  hostname: text("hostname").notNull(),
  mac: text("mac").notNull().unique(),
  ip: text("ip").notNull(),
  certFingerprint: text("cert_fingerprint").notNull(),
  networkId: integer("network_id").references(() => networksTable.id),
  status: deviceStatusEnum("status").notNull().default("active"),
  platform: text("platform").notNull().default("linux"),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDeviceSchema = createInsertSchema(devicesTable).omit({ id: true, createdAt: true });
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devicesTable.$inferSelect;
