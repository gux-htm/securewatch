import { pgTable, serial, text, boolean, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const resourceTypeEnum = pgEnum("resource_type", ["file", "directory", "database", "api", "other"]);

export const resourcesTable = pgTable("resources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: resourceTypeEnum("type").notNull().default("file"),
  path: text("path").notNull(),
  description: text("description"),
  baselineHash: text("baseline_hash"),
  currentHash: text("current_hash"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aclEntriesTable = pgTable("acl_entries", {
  id: serial("id").primaryKey(),
  resourceId: serial("resource_id").references(() => resourcesTable.id, { onDelete: "cascade" }).notNull(),
  subject: text("subject").notNull(), // username or group name
  subjectType: text("subject_type").notNull().default("user"), // user | group
  permittedActions: jsonb("permitted_actions").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("active"), // active | revoked
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const insertResourceSchema = createInsertSchema(resourcesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAclEntrySchema = createInsertSchema(aclEntriesTable).omit({ id: true, grantedAt: true });
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type Resource = typeof resourcesTable.$inferSelect;
export type AclEntry = typeof aclEntriesTable.$inferSelect;
