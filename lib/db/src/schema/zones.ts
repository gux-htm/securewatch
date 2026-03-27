import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const networkZonesTable = pgTable("network_zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cidr: text("cidr").notNull(), // e.g. 10.0.0.0/8
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNetworkZoneSchema = createInsertSchema(networkZonesTable).omit({ id: true, createdAt: true });
export type InsertNetworkZone = z.infer<typeof insertNetworkZoneSchema>;
export type NetworkZone = typeof networkZonesTable.$inferSelect;
