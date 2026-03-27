import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const networkStatusEnum = pgEnum("network_status", ["active", "inactive"]);

export const networksTable = pgTable("networks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  subnet: text("subnet").notNull(),
  port: integer("port").notNull().default(1194),
  protocol: text("protocol").notNull().default("udp"),
  status: networkStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNetworkSchema = createInsertSchema(networksTable).omit({ id: true, createdAt: true });
export type InsertNetwork = z.infer<typeof insertNetworkSchema>;
export type Network = typeof networksTable.$inferSelect;
