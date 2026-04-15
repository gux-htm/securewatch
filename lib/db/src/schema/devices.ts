import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { networksTable } from "./networks";

export const deviceStatusEnum = pgEnum("device_status", [
  "active", "inactive", "blocked", "pending_vpn", "vpn_issued",
  "pending_approval", "approved_awaiting_setup",
]);

export const devicesTable = pgTable("devices", {
  id: serial("id").primaryKey(),
  hostname: text("hostname").notNull(),
  mac: text("mac").notNull().unique(),
  ip: text("ip").notNull(),
  staticIp: text("static_ip"),
  label: text("label"),
  certFingerprint: text("cert_fingerprint").notNull(),
  networkId: integer("network_id").references(() => networksTable.id),
  status: deviceStatusEnum("status").notNull().default("pending_approval"),
  platform: text("platform").notNull().default("linux"),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Account credentials — set after admin approval
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  // WebAuthn passkey
  passkeyCredentialId: text("passkey_credential_id"),
  passkeyPublicKey: text("passkey_public_key"),
  passkeyCounter: integer("passkey_counter").default(0),
  passkeyChallenge: text("passkey_challenge"), // temp storage during registration
});

export const insertDeviceSchema = createInsertSchema(devicesTable).omit({ id: true, createdAt: true });
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devicesTable.$inferSelect;
