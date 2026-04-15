import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { devicesTable } from "./devices";
import { networksTable } from "./networks";

export const ovpnIssuancesTable = pgTable("ovpn_issuances", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").references(() => devicesTable.id, { onDelete: "cascade" }).notNull(),
  networkId: integer("network_id").references(() => networksTable.id, { onDelete: "cascade" }).notNull(),
  commonName: text("common_name").notNull(),
  certSerial: text("cert_serial").notNull(),
  clientCertFingerprint: text("client_cert_fingerprint"),
  revoked: boolean("revoked").notNull().default(false),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOvpnIssuanceSchema = createInsertSchema(ovpnIssuancesTable).omit({ id: true, createdAt: true });
export type InsertOvpnIssuance = z.infer<typeof insertOvpnIssuanceSchema>;
export type OvpnIssuance = typeof ovpnIssuancesTable.$inferSelect;
