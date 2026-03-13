import { pgTable, serial, text, boolean, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const subdomainStatusEnum = pgEnum("subdomain_status", ["pending", "active", "suspended", "rejected"]);

export const subdomainsTable = pgTable("subdomains", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  domain: text("domain").notNull().unique(),
  status: subdomainStatusEnum("status").notNull().default("pending"),
  siteName: text("site_name"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  nsVerified: boolean("ns_verified").notNull().default(false),
  nsTarget: text("ns_target"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Subdomain = typeof subdomainsTable.$inferSelect;
export type InsertSubdomain = typeof subdomainsTable.$inferInsert;
