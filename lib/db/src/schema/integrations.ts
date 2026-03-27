import { pgTable, serial, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const integrationStatusEnum = pgEnum("integration_status", ["ACTIVE", "DEGRADED", "SILENT", "DISCONNECTED"]);

export const integrationsTable = pgTable("integrations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // siem | edr | syslog | webhook | kafka | custom
  method: text("method").notNull().default("push"), // push | pull
  version: text("version"),
  endpoint: text("endpoint"),
  status: integrationStatusEnum("status").notNull().default("DISCONNECTED"),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIntegrationSchema = createInsertSchema(integrationsTable).omit({ id: true, createdAt: true });
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Integration = typeof integrationsTable.$inferSelect;
