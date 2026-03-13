import { pgTable, serial, integer, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orderStatusEnum = pgEnum("order_status", ["pending", "processing", "active", "completed", "partial", "cancelled", "failed"]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  serviceId: integer("service_id").notNull(),
  link: text("link").notNull(),
  quantity: integer("quantity").notNull(),
  startCount: integer("start_count"),
  remains: integer("remains"),
  charge: numeric("charge", { precision: 10, scale: 4 }).notNull(),
  status: orderStatusEnum("status").notNull().default("pending"),
  providerOrderId: text("provider_order_id"),
  runs: integer("runs"),
  interval: integer("interval"),
  comments: text("comments"),
  username: text("username"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orderLogsTable = pgTable("order_logs", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  status: text("status").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderLog = typeof orderLogsTable.$inferSelect;
