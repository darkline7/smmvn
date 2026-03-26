import { pgTable, serial, integer, text, boolean, numeric, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const announcementTypeEnum = pgEnum("announcement_type", ["info", "warning", "maintenance", "success"]);
export const notificationTypeEnum = pgEnum("notification_type", ["system", "order", "ticket", "deposit"]);
export const apiLogStatusEnum = pgEnum("api_log_status", ["success", "error"]);
export const auditStatusEnum = pgEnum("audit_status", ["success", "failed"]);

export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: announcementTypeEnum("type").notNull().default("info"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull(),
  referredUserId: integer("referred_user_id").notNull(),
  commission: numeric("commission", { precision: 10, scale: 4 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const siteSettingsTable = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const apiRequestLogsTable = pgTable("api_request_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  action: text("action").notNull(),
  requestBody: jsonb("request_body"),
  responseBody: jsonb("response_body"),
  status: apiLogStatusEnum("status").notNull(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAnnouncementSchema = createInsertSchema(announcementsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Announcement = typeof announcementsTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
export type SiteSetting = typeof siteSettingsTable.$inferSelect;
export type ApiRequestLog = typeof apiRequestLogsTable.$inferSelect;

export const cardChargesTable = pgTable("card_charges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  telco: text("telco").notNull(),
  serial: text("serial").notNull(),
  code: text("code").notNull(),
  declaredAmount: integer("declared_amount").notNull(),
  actualAmount: numeric("actual_amount", { precision: 12, scale: 2 }),
  requestId: text("request_id").notNull().unique(),
  status: integer("status").notNull().default(2),
  message: text("message"),
  usdCredited: numeric("usd_credited", { precision: 10, scale: 4 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type CardCharge = typeof cardChargesTable.$inferSelect;

// ── Audit Logs ────────────────────────────────────────────────────────────────
// Track admin actions for security & compliance
export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),          // Who performed the action
  resource: text("resource").notNull(),           // What resource (user, order, settings)
  action: text("action").notNull(),               // What action (create, update, delete)
  resourceId: text("resource_id"),                // ID of resource being acted upon
  details: jsonb("details"),                      // Additional context (old/new values)
  status: auditStatusEnum("status").notNull(),    // success or failed
  errorMessage: text("error_message"),            // If failed, what was the error
  ip: text("ip_address"),                         // Client IP
  userAgent: text("user_agent"),                  // Client user agent
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type AuditLog = typeof auditLogsTable.$inferSelect;
