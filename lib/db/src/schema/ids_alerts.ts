import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { idsSignaturesTable } from "./ids_signatures";
import { devicesTable } from "./devices";
import { idsSeverityEnum, idsActionEnum } from "./ids_signatures";

export const idsAlertsTable = pgTable("ids_alerts", {
  id: serial("id").primaryKey(),
  signatureId: integer("signature_id").references(() => idsSignaturesTable.id),
  deviceId: integer("device_id").references(() => devicesTable.id),
  sourceIp: text("source_ip"),
  destIp: text("dest_ip"),
  severity: idsSeverityEnum("severity").notNull(),
  action: idsActionEnum("action").notNull(),
  payload: text("payload"),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIdsAlertSchema = createInsertSchema(idsAlertsTable).omit({ id: true, createdAt: true });
export type InsertIdsAlert = z.infer<typeof insertIdsAlertSchema>;
export type IdsAlert = typeof idsAlertsTable.$inferSelect;
