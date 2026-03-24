import { pgTable, serial, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const idsCategoryEnum = pgEnum("ids_category", ["malware", "portscan", "bruteforce", "dos", "exploit", "anomaly", "custom"]);
export const idsSeverityEnum = pgEnum("ids_severity", ["low", "medium", "high", "critical"]);
export const idsActionEnum = pgEnum("ids_action", ["alert", "block", "drop"]);

export const idsSignaturesTable = pgTable("ids_signatures", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pattern: text("pattern").notNull(),
  category: idsCategoryEnum("category").notNull(),
  severity: idsSeverityEnum("severity").notNull(),
  action: idsActionEnum("action").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIdsSignatureSchema = createInsertSchema(idsSignaturesTable).omit({ id: true, createdAt: true });
export type InsertIdsSignature = z.infer<typeof insertIdsSignatureSchema>;
export type IdsSignature = typeof idsSignaturesTable.$inferSelect;
