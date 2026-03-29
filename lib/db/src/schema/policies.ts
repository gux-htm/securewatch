import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { devicesTable } from "./devices";

export const policiesTable = pgTable("policies", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").references(() => devicesTable.id),
  userId: integer("user_id"),
  groupName: text("group_name"),
  resourcePath: text("resource_path").notNull(),
  permissions: jsonb("permissions").notNull().$type<{
    view: boolean;
    edit: boolean;
    delete: boolean;
    rename: boolean;
    fullControl: boolean;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPolicySchema = createInsertSchema(policiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export type Policy = typeof policiesTable.$inferSelect;
