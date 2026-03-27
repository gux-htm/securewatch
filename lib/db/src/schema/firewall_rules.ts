import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { networksTable } from "./networks";
import { devicesTable } from "./devices";

export const firewallActionEnum = pgEnum("firewall_action", ["allow", "deny", "drop"]);
export const firewallProtocolEnum = pgEnum("firewall_protocol", ["tcp", "udp", "icmp", "any"]);
export const firewallDirectionEnum = pgEnum("firewall_direction", ["inbound", "outbound", "both"]);

export const firewallRulesTable = pgTable("firewall_rules", {
  id: serial("id").primaryKey(),
  networkId: integer("network_id").references(() => networksTable.id),
  deviceId: integer("device_id").references(() => devicesTable.id),
  action: firewallActionEnum("action").notNull(),
  sourceIp: text("source_ip"),
  destIp: text("dest_ip"),
  sourcePort: integer("source_port"),
  destPort: integer("dest_port"),
  protocol: firewallProtocolEnum("protocol").notNull().default("any"),
  direction: firewallDirectionEnum("direction").notNull().default("both"),
  priority: integer("priority").notNull().default(100),
  enabled: boolean("enabled").notNull().default(true),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFirewallRuleSchema = createInsertSchema(firewallRulesTable).omit({ id: true, createdAt: true });
export type InsertFirewallRule = z.infer<typeof insertFirewallRuleSchema>;
export type FirewallRule = typeof firewallRulesTable.$inferSelect;
